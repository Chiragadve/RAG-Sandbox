'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { PDFParser } from 'pdf2json'
import * as mammoth from 'mammoth'
import * as Papa from 'papaparse'
import Groq from "groq-sdk"

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

async function extractText(file: File, buffer: Buffer): Promise<string> {
    const type = file.type
    const name = file.name

    if (type === 'application/pdf') {
        return new Promise((resolve, reject) => {
            const pdfParser = new (require('pdf2json'))(null, 1); // 1 = text only

            pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));

            pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                resolve(pdfParser.getRawTextContent());
            });

            pdfParser.parseBuffer(buffer);
        });
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

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 50,
        })

        const chunks = await splitter.createDocuments([text])
        console.log(`Generated ${chunks.length} chunks`)

        const chunkRecords = []

        for (const chunk of chunks) {
            const content = chunk.pageContent

            const { data: embedData, error: embedError } = await supabase.functions.invoke('embed', {
                body: { input: content }
            })

            if (embedError) {
                console.error('Embedding error:', embedError)
                continue
            }

            if (!embedData || !embedData.embedding) {
                console.error('No embedding returned')
                continue
            }

            chunkRecords.push({
                document_id: doc.id,
                content: content,
                embedding: embedData.embedding,
                metadata: chunk.metadata
            })
        }

        if (chunkRecords.length > 0) {
            const { error: insertError } = await supabase
                .from('chunks')
                .insert(chunkRecords)

            if (insertError) throw insertError
        }

        if (chunkRecords.length === 0) {
            throw new Error('All chunks failed to embed. Check server logs.')
        }

        return { success: true, count: chunkRecords.length, documentId: doc.id }

    } catch (error: any) {
        console.error('Processing failed:', error)
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

export async function chat(message: string) {
    try {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            return { success: false, error: "Server Configuration Error: GROQ_API_KEY is missing. Please restart the server." }
        }

        const groq = new Groq({ apiKey })

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error('Unauthorized')

        // 1. Embed the query
        const { data: embedData, error: embedError } = await supabase.functions.invoke('embed', {
            body: { input: message }
        })

        if (embedError || !embedData?.embedding) {
            throw new Error('Failed to generate embedding for query')
        }

        // 2. Search for relevant documents
        const { data: documents, error: searchError } = await supabase.rpc('match_documents', {
            query_embedding: embedData.embedding,
            match_threshold: 0.5, // Similarity threshold
            match_count: 5 // Retrieve top 5 chunks
        })

        if (searchError) {
            console.error('Search error:', searchError)
            throw new Error('Failed to search documents')
        }

        // 3. Construct Context
        const context = documents?.map((doc: any) => doc.content).join('\n\n') || ''

        console.log(`Found ${documents?.length || 0} relevant chunks`)

        // 4. Generate Answer with Groq
        const systemPrompt = `You are a helpful AI assistant. Use the following context to answer the user's question. 
        If the answer is not in the context, say you don't know. 
        
        Context:
        ${context}
        `

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile", // Fast and good
        })

        return {
            success: true,
            message: completion.choices[0]?.message?.content || "No response generated.",
            sources: documents // Return sources for UI to show
        }

    } catch (error: any) {
        console.error('Chat failed:', error)
        return { success: false, error: error.message }
    }
}
