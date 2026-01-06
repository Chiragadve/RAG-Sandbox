/**
 * Save OCR Result API
 * 
 * Receives pre-extracted text from client-side OCR and saves to database.
 * This avoids server-side OCR which doesn't work on Vercel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { vectorizeIncrementally, ChunkRecord } from '@/lib/vectorize-pipeline';

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

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { filename, text } = body;

        if (!filename || !text) {
            return NextResponse.json({ success: false, error: 'Missing filename or text' }, { status: 400 });
        }

        if (text.trim().length < 10) {
            return NextResponse.json({ success: false, error: 'Extracted text is too short' }, { status: 400 });
        }

        // Create document record
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .insert({
                name: filename,
                type: 'application/pdf',
                user_id: user.id
            })
            .select()
            .single();

        if (docError) {
            return NextResponse.json({ success: false, error: docError.message }, { status: 500 });
        }

        // Vectorize the text
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
                    documentName: chunk.documentName
                },
                chunk_index: chunk.chunkIndex
            });
            return !error;
        };

        const vecResult = await vectorizeIncrementally(
            text,
            doc.id,
            'ocr', // Source is OCR
            embedFn,
            storeFn,
            undefined,
            undefined,
            filename
        );

        return NextResponse.json({
            success: true,
            documentId: doc.id,
            chunks: vecResult.totalChunks
        });

    } catch (e) {
        const err = e as Error;
        console.error('[SaveOCRResult] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
