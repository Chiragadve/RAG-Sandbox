/**
 * Incremental Vectorization Pipeline
 * 
 * Design principles:
 * - Chunk per page (never cross page boundaries)
 * - Embed immediately after chunking
 * - Store vectors incrementally
 * - Track progress per page
 * - Enable crash recovery
 * 
 * Atomic unit: (document_id, page_number, chunk_index)
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// ============================================================================
// Configuration
// ============================================================================

export interface VectorizationConfig {
    chunkSize: number;           // Target chunk size in characters
    chunkOverlap: number;        // Overlap between chunks
    batchSize: number;           // Chunks to embed before yielding

    // Budget controls (Constraint 6)
    maxChunksPerDocument: number;    // Cap per document
    embeddingBatchSize: number;      // Batch embedding calls
    embeddingRateLimitMs: number;    // Delay between batches
}

export const DEFAULT_VECTORIZATION_CONFIG: VectorizationConfig = {
    chunkSize: 500,              // ~100-125 tokens
    chunkOverlap: 50,            // Small overlap for context
    batchSize: 10,               // Embed 10 chunks at a time

    // Budget controls
    maxChunksPerDocument: 500,   // Max 500 chunks per doc
    embeddingBatchSize: 20,      // Embed 20 at a time
    embeddingRateLimitMs: 100,   // 100ms between batches
};

// ============================================================================
// Types
// ============================================================================

export interface PageText {
    pageNumber: number;
    text: string;
    source: 'pdf2json' | 'ocr' | 'hybrid';
}

export interface ChunkRecord {
    documentId: string;
    documentName?: string;  // Include document name for searchability
    page: number;
    chunkIndex: number;
    content: string;
    source: 'pdf2json' | 'ocr' | 'hybrid';
    embedding?: number[];
}

export interface VectorizationProgress {
    pagesProcessed: number;
    totalPages: number;
    chunksCreated: number;
    chunksEmbedded: number;
    phase: 'chunking' | 'embedding' | 'storing' | 'complete';
}

export interface VectorizationResult {
    success: boolean;
    documentId: string;
    totalPages: number;
    totalChunks: number;
    processingTimeMs: number;
    userMessage: string;
    failureReason?: string;
}

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalize text before chunking
 * - Remove excessive whitespace
 * - Normalize line breaks
 * - Trim
 */
function normalizeText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')           // Normalize line endings
        .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
        .replace(/[ \t]+/g, ' ')          // Collapse spaces/tabs
        .replace(/^ +| +$/gm, '')         // Trim line starts/ends
        .trim();
}

// ============================================================================
// Per-Page Chunking
// ============================================================================

/**
 * Chunk a single page's text
 * Returns chunks with page number and index metadata
 */
async function chunkPage(
    pageText: PageText,
    config: VectorizationConfig
): Promise<ChunkRecord[]> {
    const normalized = normalizeText(pageText.text);

    // Skip empty pages
    if (!normalized || normalized.length < 10) {
        return [];
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
    });

    const docs = await splitter.createDocuments([normalized]);

    return docs.map((doc, idx) => ({
        documentId: '',  // Will be set later
        page: pageText.pageNumber,
        chunkIndex: idx,
        content: doc.pageContent,
        source: pageText.source,
    }));
}

// ============================================================================
// Embedding Function Types
// ============================================================================

export type EmbedFunction = (text: string) => Promise<number[] | null>;

// Batch embed function - much faster than one-by-one
export type BatchEmbedFunction = (texts: string[]) => Promise<(number[] | null)[]>;

// ============================================================================
// Incremental Vectorization
// ============================================================================

/**
 * Process extracted text incrementally:
 * 1. Parse into pages
 * 2. Chunk each page
 * 3. Embed each chunk
 * 4. Store immediately
 * 
 * @param text - Full extracted text (with page markers if available)
 * @param documentId - Document ID for vector metadata
 * @param source - Extraction source (pdf2json, ocr, hybrid)
 * @param embedFn - Function to generate embeddings
 * @param storeFn - Function to store a chunk with embedding
 * @param onProgress - Progress callback
 */
export async function vectorizeIncrementally(
    text: string,
    documentId: string,
    source: 'pdf2json' | 'ocr' | 'hybrid',
    embedFn: EmbedFunction,
    storeFn: (chunk: ChunkRecord) => Promise<boolean>,
    config: VectorizationConfig = DEFAULT_VECTORIZATION_CONFIG,
    onProgress?: (progress: VectorizationProgress) => void,
    documentName?: string  // Optional document name for better searchability
): Promise<VectorizationResult> {
    const startTime = Date.now();

    console.log(`[Vectorize] START: doc=${documentId}, source=${source}`);

    try {
        // Step 1: Split text into pages (or treat as single page if no markers)
        const pages = splitIntoPages(text, source);
        const totalPages = pages.length;

        console.log(`[Vectorize] Split into ${totalPages} pages`);

        let chunksCreated = 0;
        let chunksEmbedded = 0;
        let pagesProcessed = 0;

        // Step 2: Process each page incrementally
        for (const pageText of pages) {
            if (onProgress) {
                onProgress({
                    pagesProcessed,
                    totalPages,
                    chunksCreated,
                    chunksEmbedded,
                    phase: 'chunking'
                });
            }

            // Chunk this page
            const chunks = await chunkPage(pageText, config);

            // Set document ID and name on each chunk
            chunks.forEach((c, idx) => {
                c.documentId = documentId;
                c.documentName = documentName;

                // Prepend document name to first chunk of first page for searchability
                if (pagesProcessed === 0 && idx === 0 && documentName) {
                    c.content = `Document: ${documentName}\\n\\n${c.content}`;
                }
            });
            chunksCreated += chunks.length;

            // Check max chunks budget
            if (chunksCreated > config.maxChunksPerDocument) {
                console.log(`[Vectorize] Max chunks reached (${config.maxChunksPerDocument}), stopping at page ${pagesProcessed + 1}`);
                const chunksToSkip = chunksCreated - config.maxChunksPerDocument;
                chunks.splice(chunks.length - chunksToSkip, chunksToSkip);
                chunksCreated = config.maxChunksPerDocument;
            }

            // Step 3: Embed in batches with rate limiting
            const EMBED_BATCH_SIZE = config.embeddingBatchSize;

            if (onProgress) {
                onProgress({
                    pagesProcessed,
                    totalPages,
                    chunksCreated,
                    chunksEmbedded,
                    phase: 'embedding'
                });
            }

            // Process chunks in batches with rate limiting
            for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
                const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);

                // Rate limit between batches
                if (i > 0 && config.embeddingRateLimitMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, config.embeddingRateLimitMs));
                }

                // Embed batch in parallel
                const embedPromises = batch.map(async (chunk) => {
                    const embedding = await embedFn(chunk.content);
                    if (embedding) {
                        chunk.embedding = embedding;
                        return chunk;
                    }
                    return null;
                });

                const embeddedChunks = await Promise.all(embedPromises);

                // Store successfully embedded chunks
                if (onProgress) {
                    onProgress({
                        pagesProcessed,
                        totalPages,
                        chunksCreated,
                        chunksEmbedded,
                        phase: 'storing'
                    });
                }

                // Store in parallel too
                const storePromises = embeddedChunks
                    .filter((c): c is ChunkRecord => c !== null)
                    .map(async (chunk) => {
                        const stored = await storeFn(chunk);
                        return stored ? 1 : 0;
                    });

                const results = await Promise.all(storePromises);
                chunksEmbedded += results.reduce((a: number, b: number) => a + b, 0 as number);
            }

            pagesProcessed++;
            console.log(`[Vectorize] Page ${pagesProcessed}/${totalPages}: ${chunks.length} chunks embedded`);

            // Stop if we hit max chunks
            if (chunksCreated >= config.maxChunksPerDocument) {
                console.log(`[Vectorize] Hit max chunks limit (${config.maxChunksPerDocument}), stopping early`);
                break;
            }
        }

        const processingTimeMs = Date.now() - startTime;

        if (onProgress) {
            onProgress({
                pagesProcessed: totalPages,
                totalPages,
                chunksCreated,
                chunksEmbedded,
                phase: 'complete'
            });
        }

        console.log(`[Vectorize] SUCCESS: ${chunksEmbedded} chunks in ${processingTimeMs}ms`);

        return {
            success: chunksEmbedded > 0,
            documentId,
            totalPages,
            totalChunks: chunksEmbedded,
            processingTimeMs,
            userMessage: chunksEmbedded > 0
                ? `Successfully indexed ${chunksEmbedded} text chunks from ${totalPages} pages`
                : 'No chunks could be embedded'
        };

    } catch (error) {
        const err = error as Error;
        console.error(`[Vectorize] ERROR:`, err.message);

        return {
            success: false,
            documentId,
            totalPages: 0,
            totalChunks: 0,
            processingTimeMs: Date.now() - startTime,
            userMessage: 'Vectorization failed',
            failureReason: err.message
        };
    }
}

// ============================================================================
// Page Splitting Helpers
// ============================================================================

/**
 * Split text into pages
 * Detects page markers or treats as single page
 */
function splitIntoPages(text: string, source: 'pdf2json' | 'ocr' | 'hybrid'): PageText[] {
    // Check for common page markers
    const pageBreakPattern = /(?:\n\n---\s*Page\s*\d+\s*---\n\n|\f)/gi;

    // For OCR, pages are typically separated by double newlines
    if (source === 'ocr') {
        // OCR results are usually separated by \n\n between pages
        // But we might not have clear page boundaries, so treat as chunks
        const ocrPages = text.split(/\n{3,}/);

        if (ocrPages.length > 1) {
            return ocrPages.map((pageText, idx) => ({
                pageNumber: idx + 1,
                text: pageText,
                source
            })).filter(p => p.text.trim().length > 10);
        }
    }

    // Check for form feed characters (common page separator)
    if (text.includes('\f')) {
        return text.split('\f').map((pageText, idx) => ({
            pageNumber: idx + 1,
            text: pageText,
            source
        })).filter(p => p.text.trim().length > 10);
    }

    // Check for text-based page markers
    if (pageBreakPattern.test(text)) {
        return text.split(pageBreakPattern).map((pageText, idx) => ({
            pageNumber: idx + 1,
            text: pageText,
            source
        })).filter(p => p.text.trim().length > 10);
    }

    // No page markers - split into logical chunks based on length
    // This provides pseudo-pages for better incremental processing
    const TARGET_PAGE_SIZE = 3000;  // ~3KB per "page"
    const pages: PageText[] = [];

    if (text.length <= TARGET_PAGE_SIZE) {
        pages.push({ pageNumber: 1, text, source });
    } else {
        // Split by paragraphs, then group into pages
        const paragraphs = text.split(/\n\n+/);
        let currentPage = '';
        let pageNum = 1;

        for (const para of paragraphs) {
            if (currentPage.length + para.length > TARGET_PAGE_SIZE && currentPage.length > 0) {
                pages.push({ pageNumber: pageNum, text: currentPage, source });
                pageNum++;
                currentPage = para;
            } else {
                currentPage += (currentPage ? '\n\n' : '') + para;
            }
        }

        if (currentPage.length > 0) {
            pages.push({ pageNumber: pageNum, text: currentPage, source });
        }
    }

    return pages.filter(p => p.text.trim().length > 10);
}

// ============================================================================
// Chunk ID Generator (for deduplication/recovery)
// ============================================================================

/**
 * Generate unique chunk ID for vector store
 * Format: documentId:page:chunkIndex
 */
export function generateChunkId(documentId: string, page: number, chunkIndex: number): string {
    return `${documentId}:${page}:${chunkIndex}`;
}
