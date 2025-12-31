'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PDFParser from 'pdf2json'
import * as mammoth from 'mammoth'
import * as Papa from 'papaparse'
import Groq from "groq-sdk"
import { listTools, callTool } from '@/lib/mcp'
import { extractPDFText } from '@/lib/pdf-pipeline'
import { vectorizeIncrementally, ChunkRecord } from '@/lib/vectorize-pipeline'
import { generatePodcastScript, synthesizePodcastAudio, generateStoryScript, synthesizeStoryAudio } from '@/lib/podcast'
import { getAuthUrl, getTokens } from '@/lib/google_auth'
import { listEmails, getEmailContent } from '@/lib/gmail'
import { redirect } from 'next/navigation'

// ... existing imports

// --- GMAIL INTEGRATION ACTIONS ---

export async function connectGmail() {
    const url = getAuthUrl()
    redirect(url)
}

export async function handleOAuthCallback(code: string) {
    try {
        const tokens = await getTokens(code)

        // Store tokens securely. For this prototype, we'll store in a new Supabase table 'user_tokens'
        // or as a secure cookie. A robust app would encrypt this.
        // Let's assume we store it in a simple 'auth_tokens' table for the user.

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        // Ideally, check if table exists or just upsert if we have schema.
        // Fallback: Using 'documents' metadata might be risky for secrets.
        // Better: Set an HttpOnly cookie for the session? 
        // Best Logic for this assignment: Encrypted in 'profiles' or dedicated table.

        // QUICK FIX for prototype: Store in a plain 'secrets' table (user_id, service, tokens)
        // Check if table exists, if not, we might fail.
        // Let's try to just return the tokens to the client to set as a cookie for now to keep it stateless-ish
        // or set a cookie here.

        // Setting cookie for next-auth style perisistence
        // Note: 'cookies' function is read-only in Server Actions context usually unless importing from next/headers
        // But we are in a server action.

        // Actually, simple approach: Write to 'user_preferences' or similar table.
        // Let's try to upsert to a 'gmail_tokens' row in 'documents' table? No, messy.

        // IMPLEMENTATION CHOICE: Return tokens, let client save to cookie? No, security risk.
        // We will save to a new table 'integrations' in the next step. 
        // For now, let's just log and redirect to home with a success param.
        // We need a place to store it. I'll create an SQL migration for 'integrations' table next.
        // Assuming it exists or I will create it.

        const { error } = await supabase
            .from('integrations')
            .upsert({
                user_id: user.id,
                service: 'gmail',
                tokens: tokens,
                updated_at: new Date().toISOString()
            })

        if (error) {
            // If table completely missing, log it.
            console.error("Failed to store tokens (table might be missing):", error)
            // Fallback: Just return error
            return { success: false, error: "Database not ready for integrations" }
        }

        return { success: true }
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("OAuth Callback Error:", error)
        return { success: false, error: error.message }
    }
}

export async function ingestGmail() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // 1. Retrieve tokens
        const { data: integration, error: tokenError } = await supabase
            .from('integrations')
            .select('tokens')
            .eq('user_id', user.id)
            .eq('service', 'gmail')
            .single()

        if (tokenError || !integration) throw new Error("Gmail not connected")

        const tokens = integration.tokens

        // 2. List Emails
        const messages = await listEmails(tokens.access_token, tokens.refresh_token, 5) // Fetch last 5
        let count = 0

        // 3. Process each email
        for (const msg of messages) {
            const emailContent = await getEmailContent(msg.id!, tokens.access_token, tokens.refresh_token)

            // 4. Save as Document
            // Check existence to prevent duplicates
            const { data: existing } = await supabase
                .from('documents')
                .select('id')
                .eq('name', `Email: ${emailContent.subject}`)
                .single()

            if (existing) continue;

            const { data: doc, error: docError } = await supabase
                .from('documents')
                .insert({
                    name: `Email: ${emailContent.subject}`,
                    user_id: user.id,
                    type: 'email'
                })
                .select().single()

            if (docError) {
                console.error("Error saving email doc:", docError); continue;
            }

            // 5. Chunk and Embed (Reusing existing logic logic would be better but simple insert here)
            // We'll call the internal chunk logic or just save raw chunks.
            // Simplified: Save one big chunk for now or reuse logic?
            // Reusing processText logic would be ideal but it's bound to file upload.
            // Let's just insert one chunk.

            const embedding = await generateEmbedding(emailContent.fullText)

            await supabase.from('chunks').insert({
                document_id: doc.id,
                content: emailContent.fullText,
                chunk_index: 0,
                embedding
            })

            count++
        }

        return { success: true, count }

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("Ingest Gmail Error:", error)
        return { success: false, error: error.message }
    }
}

// ... existing imports

export async function generatePodcast(documentIds: string[]) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        if (!documentIds || documentIds.length === 0) {
            throw new Error("No documents selected")
        }

        // 1. Fetch document chunks to reconstruct text for ALL docs
        const { data: chunks, error: chunkError } = await supabase
            .from('chunks')
            .select('content, chunk_index, document_id')
            .in('document_id', documentIds)
            .order('chunk_index', { ascending: true })

        if (chunkError || !chunks || chunks.length === 0) {
            throw new Error('Failed to retrieve content for selected documents')
        }

        // 1b. Fetch doc names for filename
        const { data: docs } = await supabase.from('documents').select('name').in('id', documentIds)
        const docNameSummary = docs ? docs.map(d => d.name).join('+').slice(0, 50) : 'combined_docs'

        const fullText = chunks.map(c => c.content).join('\n\n')

        // 2. Generate Script
        console.log(`Generating podcast script for ${documentIds.length} docs (Length: ${fullText.length})`)
        const script = await generatePodcastScript(fullText)

        // 3. Synthesize Audio
        console.log(`Synthesizing audio for ${script.length} segments`)
        const audioBuffer = await synthesizePodcastAudio(script)

        // 4. Upload to Storage
        const fileName = `podcast_${docNameSummary.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.wav`

        // Try 'podcasts' bucket first, fallback to 'documents'
        let bucket = 'podcasts'
        let publicUrl = ''

        const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, audioBuffer, {
            contentType: 'audio/wav',
            upsert: true
        })

        if (uploadError) {
            console.warn("Upload to 'podcasts' failed, trying 'documents/podcasts'...", uploadError)
            bucket = 'documents' // Fallback
            const { error: retryError } = await supabase.storage.from(bucket).upload(`podcasts/${fileName}`, audioBuffer, {
                contentType: 'audio/wav',
                upsert: true
            })
            if (retryError) throw new Error(`Upload failed: ${retryError.message}`)

            const res = supabase.storage.from(bucket).getPublicUrl(`podcasts/${fileName}`)
            publicUrl = res.data.publicUrl
        } else {
            const res = supabase.storage.from(bucket).getPublicUrl(fileName)
            publicUrl = res.data.publicUrl
        }

        return { success: true, audioUrl: publicUrl, script, title: docNameSummary }

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error('Podcast Generation Failed:', error)
        return { success: false, error: error.message }
    }
}

// ============================================================
// STORY MODE - First-Person Narration
// ============================================================

export async function generateStory(documentIds: string[]) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        if (!documentIds || documentIds.length === 0) {
            throw new Error("No documents selected")
        }

        // 1. Fetch document chunks to reconstruct text for ALL docs
        const { data: chunks, error: chunkError } = await supabase
            .from('chunks')
            .select('content, chunk_index, document_id')
            .in('document_id', documentIds)
            .order('chunk_index', { ascending: true })

        if (chunkError || !chunks || chunks.length === 0) {
            throw new Error('Failed to retrieve content for selected documents')
        }

        // 1b. Fetch doc names for filename
        const { data: docs } = await supabase.from('documents').select('name').in('id', documentIds)
        const docNameSummary = docs ? docs.map(d => d.name).join('+').slice(0, 50) : 'interview_story'

        const fullText = chunks.map(c => c.content).join('\n\n')

        // 2. Generate Story Script (First-Person Narration)
        console.log(`Generating story script for ${documentIds.length} docs (Length: ${fullText.length})`)
        const script = await generateStoryScript(fullText)

        // 3. Synthesize Audio with Narrator Voice
        console.log(`Synthesizing story audio for ${script.length} segments`)
        const audioBuffer = await synthesizeStoryAudio(script)

        // 4. Upload to Storage
        const fileName = `story_${docNameSummary.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.wav`

        // Try 'podcasts' bucket first, fallback to 'documents'
        let bucket = 'podcasts'
        let publicUrl = ''

        const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, audioBuffer, {
            contentType: 'audio/wav',
            upsert: true
        })

        if (uploadError) {
            console.warn("Upload to 'podcasts' failed, trying 'documents/podcasts'...", uploadError)
            bucket = 'documents' // Fallback
            const { error: retryError } = await supabase.storage.from(bucket).upload(`podcasts/${fileName}`, audioBuffer, {
                contentType: 'audio/wav',
                upsert: true
            })
            if (retryError) throw new Error(`Upload failed: ${retryError.message}`)

            const res = supabase.storage.from(bucket).getPublicUrl(`podcasts/${fileName}`)
            publicUrl = res.data.publicUrl
        } else {
            const res = supabase.storage.from(bucket).getPublicUrl(fileName)
            publicUrl = res.data.publicUrl
        }

        return { success: true, audioUrl: publicUrl, script, title: docNameSummary, mode: 'story' }

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error('Story Generation Failed:', error)
        return { success: false, error: error.message }
    }
}

// Initialize Supabase Client with Auth Context (Cookies)
async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch (error) { }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) { }
                },
            },
        }
    )
}

async function generateEmbedding(input: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.functions.invoke('embed', {
        body: { input }
    })

    if (error) {
        console.error('Embedding API Error:', error)
        throw new Error(`Embedding failed: ${error.message}`)
    }

    if (!data || !data.embedding) {
        throw new Error('Embedding API returned no data')
    }

    return data.embedding
}

async function extractText(file: File, buffer: Buffer): Promise<string> {
    const type = file.type
    const name = file.name

    if (type === 'application/pdf') {
        // Production PDF Pipeline:
        // - Guardrails (size, pages, timeout)
        // - Classification (TEXT_BASED / SCANNED / MIXED / ENCRYPTED / CORRUPTED)
        // - Page-batched extraction
        // - Concurrency control (max 2)
        // - User-facing messages (no stack traces)

        console.log(`[PDF] Starting: ${file.name} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);

        const result = await extractPDFText(buffer);

        if (!result.success) {
            // Use user-facing message, never expose internals
            throw new Error(result.userMessage);
        }

        console.log(`[PDF] Complete: ${result.text.length} chars, ${result.pageCount} pages, ${result.processingTimeMs}ms, source: ${result.source}`);
        return result.text;
    }

    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer })
        return result.value
    }

    if (type === 'text/csv' || name.endsWith('.csv')) {
        const text = buffer.toString('utf-8')
        const result = Papa.parse(text, { header: true })
        return JSON.stringify(result.data, null, 2)
    }

    if (type === 'application/json' || name.endsWith('.json')) {
        return buffer.toString('utf-8')
    }

    // Fallback for text/md/code
    return buffer.toString('utf-8')
}

export async function processFile(formData: FormData) {
    try {
        const supabase = await createClient()

        // 1. Check Authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            throw new Error('Unauthorized: You must be logged in to upload files.')
        }

        const file = formData.get('file') as File
        if (!file) throw new Error('No file uploaded')

        console.log(`Processing file: ${file.name} (${file.type}) for User: ${user.id}`)

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const text = await extractText(file, buffer)

        if (!text || text.trim().length === 0) {
            throw new Error('Extracted text is empty')
        }

        // 2. Create Document Record
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .insert({
                name: file.name,
                type: file.type,
                user_id: user.id
            })
            .select()
            .single()

        if (docError) {
            console.error('Doc Insert Error:', docError)
            if (docError.code === '42501') {
                throw new Error('Permission denied. RLS prevented insertion. Are you properly logged in?')
            }
            throw new Error(`Database Error: ${docError.message}`)
        }

        // 3. Incremental Vectorization
        // - Chunks per page (not globally)
        // - Embeds immediately after chunking
        // - Stores incrementally
        // - Enables crash recovery

        const source = file.type === 'application/pdf' ? 'pdf2json' : 'pdf2json';

        // Embed function: calls Supabase edge function
        const embedFn = async (content: string): Promise<number[] | null> => {
            const { data, error } = await supabase.functions.invoke('embed', {
                body: { input: content }
            });
            if (error || !data?.embedding) {
                console.error('Embedding error:', error);
                return null;
            }
            return data.embedding;
        };

        // Store function: inserts chunk into database
        const storeFn = async (chunk: ChunkRecord): Promise<boolean> => {
            const { error } = await supabase
                .from('chunks')
                .insert({
                    document_id: chunk.documentId,
                    content: chunk.content,
                    embedding: chunk.embedding,
                    metadata: {
                        page: chunk.page,
                        chunkIndex: chunk.chunkIndex,
                        source: chunk.source
                    },
                    chunk_index: chunk.chunkIndex
                });

            if (error) {
                console.error('Store error:', error);
                return false;
            }
            return true;
        };

        const result = await vectorizeIncrementally(
            text,
            doc.id,
            source as 'pdf2json' | 'ocr' | 'hybrid',
            embedFn,
            storeFn
        );

        if (!result.success) {
            throw new Error(result.failureReason || 'Vectorization failed');
        }

        return { success: true, count: result.totalChunks, documentId: doc.id }

    } catch (error: unknown) {
        const err = error as Error;
        console.error('Processing failed:', err);
        return { success: false, error: err.message }
    }
}

// End of processFile


export async function deleteDocument(documentId: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // 1. Delete Chunks (Cascade usually handles this if configured, but explicit is safer)
        const { error: chunkError } = await supabase
            .from('chunks')
            .delete()
            .eq('document_id', documentId)

        if (chunkError) console.error("Error deleting chunks:", chunkError)

        // 2. Delete Podcast File (if any) - Optional cleanup
        // We'd need to know the filename. Skipped for now or could query podcasts bucket.

        // 3. Delete Document Record
        const { error: docError } = await supabase
            .from('documents')
            .delete()
            .eq('id', documentId)
            .eq('user_id', user.id) // Security check

        if (docError) throw new Error(docError.message)

        return { success: true }
    } catch (error: any) {
        console.error("Delete failed:", error)
        return { success: false, error: error.message }
    }
}

export async function getUserDocuments() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return []

        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching docs:', error)
            return []
        }

        return data
    } catch (error) {
        console.error('Failed to get user docs:', error)
        return []
    }
}

// Update type definition
export async function chat(message: string, history: Array<{ role: 'user' | 'assistant', content: string }> = []) {
    try {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            return { success: false, error: "Server Configuration Error: GROQ_API_KEY is missing. Please restart the server." }
        }

        const groq = new Groq({ apiKey })

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error('Unauthorized')

        // 0. Initialize MCP Tools
        let toolsList: any[] = []
        try {
            const tools = await listTools()
            toolsList = tools.tools
        } catch (e) {
            console.error("MCP Tool Usage Error:", e)
        }

        // 1. Embed the query
        const { data: embedData, error: embedError } = await supabase.functions.invoke('embed', {
            body: { input: message }
        })

        if (embedError || !embedData?.embedding) {
            throw new Error('Failed to generate embedding for query')
        }

        // 2. Adaptive Retrieval
        let documents: any[] = []

        // Try high precision first
        const { data: initialDocs } = await supabase.rpc('match_documents', {
            query_embedding: embedData.embedding,
            match_threshold: 0.60,
            match_count: 5
        })

        if (initialDocs) documents = initialDocs

        // Fallback or Expand
        if (!documents || documents.length < 2) {
            const { data: retryDocs } = await supabase.rpc('match_documents', {
                query_embedding: embedData.embedding,
                match_threshold: 0.50, // Loosen slightly
                match_count: 5
            })
            if (retryDocs) documents = retryDocs || []
        }

        // [AGENTIC GUARD]: If best match is poor (< 60%), we DON'T fail yet. 
        // We let the Agent decide if it wants to use a TOOL instead.

        // 3. Sort & Construct Context
        if (documents) {
            documents.sort((a: any, b: any) => {
                if (a.document_id !== b.document_id) return a.document_id.localeCompare(b.document_id)
                return (a.chunk_index || 0) - (b.chunk_index || 0)
            })
        }

        let context = ""
        for (const doc of documents || []) {
            if (context.length + doc.content.length > 3500) break
            context += `[Source: Local Doc (Match ${(doc.similarity * 100).toFixed(0)}%)]\n${doc.content}\n\n`
        }

        // ---------------------------------------------------------
        // STEP 1: PLANNING (The "Agentic" Step)
        // ---------------------------------------------------------
        const availableToolsText = toolsList.map((t: any) => `${t.name}: ${t.description}`).join('\n')

        const planningPrompt = `You are an expert Research Agent. 
You have access to the following tools:
${availableToolsText}

Your Goal: Answer the user's question accurately.

Instructions:
1. Check if the provided "Local Doc" context contains the answer.
2. If YES, plan to answer from context.
3. If NO (or if the question requires live data/internet), plan to use a TOOL (e.g. web_search).

Output format:
- If you need to search: "ACTION: web_search(query='...')"
- If you have enough info: "PLAN: 1. ... 2. ..."
- If you are unsure/insufficient: "INSUFFICIENT_DATA"

Context:
${context}
`

        const planCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: planningPrompt },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.1
        })

        let plan = planCompletion.choices[0]?.message?.content || "No plan generated."
        console.log("Agent Decision:", plan)

        // ---------------------------------------------------------
        // STEP 1.5: TOOL EXECUTION (If Agent requested it)
        // ---------------------------------------------------------
        let toolResults = ""

        if (plan.includes("ACTION: web_search")) {
            // Extract query using regex or simple parsing
            const match = plan.match(/query='([^']+)'/) || plan.match(/query="([^"]+)"/)
            if (match) {
                const query = match[1]
                console.log(`Executing Tool: web_search for "${query}"`)

                try {
                    const result = await callTool("web_search", { query })
                    const textContent = (result as any).content[0].text
                    toolResults = `\n[Source: Web Search Results]\n${textContent}\n`
                    context += toolResults // Append to context

                    // Update plan to "Answer from new context"
                    plan = "PLAN: Synthesize web search results to answer the question."
                } catch (err) {
                    console.error("Tool execution failed:", err)
                    toolResults = "\n[Error: Web Search failed]\n"
                }
            }
        } else if (plan.includes("INSUFFICIENT_DATA") && context.length < 50) {
            // Only return insufficient if we really have no context AND no tool logic triggered
            return {
                success: true,
                message: "I verified the documents provided, but they do not contain the answer. (Reason: No relevant local docs and no search action triggered).",
                sources: documents
            }
        }

        // ---------------------------------------------------------
        // STEP 2: WRITING (Final Response)
        // ---------------------------------------------------------
        const writerSystemPrompt = `You are a knowledgeable, conversational AI assistant.

GOALS:
- Answer clearly and confidently.
- Explain concepts step-by-step.
- Use natural language.

RULES:
- Use ONLY the provided context (Local Docs + Web Search Results).
- If using Web Search, cite it as "According to online sources..." or similar.
- If using Local Docs, cite as "According to your documents...".
- Prefer information from higher match scores.

CONTEXT:
${context}

PLAN:
${plan}
`
        // Prepare messages with history memory (Last 3 turns)
        const recentHistory = history.slice(-6).map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
        }))

        const finalCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: writerSystemPrompt },
                ...recentHistory,
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3
        })

        return {
            success: true,
            message: finalCompletion.choices[0]?.message?.content || "No response generated.",
            sources: documents
        }

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error('Chat failed:', error)
        return { success: false, error: error.message }
    }
}
