/**
 * Background File Processing API
 * 
 * Uses streaming response to return immediately while processing continues.
 * This prevents blocking the server for other requests (like chat).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { extractPDFText } from '@/lib/pdf-pipeline';
import { vectorizeIncrementally, ChunkRecord } from '@/lib/vectorize-pipeline';
import PDFParser from 'pdf2json';
import * as mammoth from 'mammoth';
import * as Papa from 'papaparse';

async function createClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                },
            },
        }
    );
}

// Extract text based on file type
async function extractText(file: File, buffer: Buffer): Promise<string> {
    const type = file.type;
    const name = file.name;

    if (type === 'application/pdf') {
        const result = await extractPDFText(buffer);
        if (!result.success) {
            throw new Error(result.userMessage);
        }
        return result.text;
    }

    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }

    if (type === 'text/csv' || name.endsWith('.csv')) {
        const text = buffer.toString('utf-8');
        const result = Papa.parse(text, { header: true });
        return JSON.stringify(result.data, null, 2);
    }

    return buffer.toString('utf-8');
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ success: false, error: 'No file' }, { status: 400 });
        }

        // Return immediately with accepted status
        // Processing continues in background via streaming
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        // Start background processing
        (async () => {
            try {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "extracting" })}\n\n`));

                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const text = await extractText(file, buffer);

                if (!text || text.trim().length === 0) {
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "error", message: "Empty text" })}\n\n`));
                    await writer.close();
                    return;
                }

                await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "saving" })}\n\n`));

                // Create document record
                const { data: doc, error: docError } = await supabase
                    .from('documents')
                    .insert({
                        name: file.name,
                        type: file.type,
                        user_id: user.id
                    })
                    .select()
                    .single();

                if (docError) {
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "error", message: docError.message })}\n\n`));
                    await writer.close();
                    return;
                }

                await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "vectorizing" })}\n\n`));

                // Vectorize
                const embedFn = async (content: string): Promise<number[] | null> => {
                    const { data, error } = await supabase.functions.invoke('embed', {
                        body: { input: content }
                    });
                    return error || !data?.embedding ? null : data.embedding;
                };

                const storeFn = async (chunk: ChunkRecord): Promise<boolean> => {
                    const { error } = await supabase.from('chunks').insert({
                        document_id: chunk.documentId,
                        content: chunk.content,
                        embedding: chunk.embedding,
                        metadata: {
                            page: chunk.page,
                            chunkIndex: chunk.chunkIndex,
                            source: chunk.source,
                            documentName: chunk.documentName  // Include for search
                        },
                        chunk_index: chunk.chunkIndex
                    });
                    return !error;
                };

                // Pass document name for vectorization
                const result = await vectorizeIncrementally(
                    text,
                    doc.id,
                    'pdf2json',
                    embedFn,
                    storeFn,
                    undefined,  // Use default config
                    undefined,  // No progress callback
                    file.name   // Pass document name
                );

                await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "complete", documentId: doc.id, chunks: result.totalChunks })}\n\n`));
                await writer.close();

            } catch (e) {
                const err = e as Error;
                await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "error", message: err.message })}\n\n`));
                await writer.close();
            }
        })();

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (e) {
        const err = e as Error;
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
