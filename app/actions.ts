'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
// @ts-ignore
// @ts-ignore
const mammoth = require('mammoth');
// @ts-ignore
const PDFParser = require('pdf2json');
// @ts-ignore
import Papa from 'papaparse'

// Helper to extract text based on file type
async function extractText(file: File, buffer: Buffer): Promise<string> {
    const type = file.type
    const name = file.name

    if (type === 'application/pdf') {
        return new Promise((resolve, reject) => {
            const pdfParser = new PDFParser(null, 1); // 1 = text only

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
        const file = formData.get('file') as File
        if (!file) throw new Error('No file uploaded')

        console.log(`Processing file: ${file.name} (${file.type})`)

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const text = await extractText(file, buffer)

        if (!text || text.trim().length === 0) {
            throw new Error('Extracted text is empty')
        }

        // 1. Create Document Record
        const { data: doc, error: docError } = await supabaseAdmin
            .from('documents')
            .insert({
                name: file.name,
                type: file.type,
            })
            .select()
            .single()

        if (docError) throw docError

        // 2. Chunk the text
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 50,
        })

        const chunks = await splitter.createDocuments([text])
        console.log(`Generated ${chunks.length} chunks`)

        // 3. Generate Embeddings & Store
        const chunkRecords = []

        for (const chunk of chunks) {
            const content = chunk.pageContent

            // Call Edge Function
            const { data: embedData, error: embedError } = await supabaseAdmin.functions.invoke('embed', {
                body: { input: content }
            })

            if (embedError) {
                console.error('Embedding error:', embedError)
                continue // Skip this chunk if embedding fails
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
            const { error: insertError } = await supabaseAdmin
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
