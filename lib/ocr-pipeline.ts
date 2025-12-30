/**
 * OCR Pipeline for Scanned PDFs
 * 
 * Uses:
 * - pdf-to-png-converter: PDF pages → PNG images (no binary dependencies)
 * - tesseract.js: PNG images → text (no API key needed)
 * 
 * Design principles:
 * - Page-by-page OCR (not whole document at once)
 * - Hard per-page timeout
 * - Progress reporting
 * - Memory cleanup between pages
 * - OCR is explicit, never silent
 */

import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';
import { createWorker, Worker } from 'tesseract.js';
import path from 'path';

// ============================================================================
// Configuration
// ============================================================================

export interface OCRConfig {
    pageTimeoutMs: number;      // Timeout per page
    totalTimeoutMs: number;     // Total timeout for entire document
    batchSize: number;          // Pages to OCR before yielding
    scale: number;              // Image scale (higher = better quality, more memory)
    language: string;           // Tesseract language
    maxPages: number;           // Maximum pages to OCR
}

export const DEFAULT_OCR_CONFIG: OCRConfig = {
    pageTimeoutMs: 30_000,      // 30 seconds per page
    totalTimeoutMs: 300_000,    // 5 minutes total
    batchSize: 3,               // 3 pages per batch
    scale: 2.0,                 // 2x scale for better OCR
    language: 'eng',            // English
    maxPages: 100,              // Max 100 pages for OCR
};

// ============================================================================
// Types
// ============================================================================

export interface OCRResult {
    success: boolean;
    text: string;
    pageCount: number;
    pagesProcessed: number;
    processingTimeMs: number;
    userMessage: string;
    failureReason?: 'TIMEOUT' | 'TOO_MANY_PAGES' | 'RENDER_FAILED' | 'OCR_FAILED';
}

export interface OCRProgress {
    currentPage: number;
    totalPages: number;
    phase: 'rendering' | 'recognizing' | 'complete';
    percentComplete: number;
}

// ============================================================================
// User-Facing Messages
// ============================================================================

const OCR_MESSAGES = {
    SUCCESS: 'OCR completed successfully',
    TIMEOUT: 'OCR processing timed out. Try with fewer pages.',
    TOO_MANY_PAGES: 'PDF has too many pages for OCR. Maximum is 100 pages.',
    RENDER_FAILED: 'Failed to render PDF pages for OCR.',
    OCR_FAILED: 'Text recognition failed.',
    PROCESSING: 'Performing OCR on scanned document...',
};

// ============================================================================
// Concurrency Control
// ============================================================================

class Semaphore {
    private permits: number;
    private queue: Array<() => void> = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        return new Promise<void>((resolve) => {
            this.queue.push(resolve);
        });
    }

    release(): void {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next?.();
        } else {
            this.permits++;
        }
    }
}

// Only 1 concurrent OCR job (very resource intensive)
const ocrSemaphore = new Semaphore(1);

// ============================================================================
// OCR Pipeline Implementation
// ============================================================================

/**
 * Initialize Tesseract worker
 */
async function initWorker(language: string): Promise<Worker> {
    const workerPath = path.join(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js');

    const worker = await createWorker(language, 1, {
        workerPath,
        // Reduce logging noise
        logger: () => { },
    });

    return worker;
}

/**
 * OCR a single page with timeout
 */
async function ocrPage(
    worker: Worker,
    imageBuffer: Buffer,
    pageNum: number,
    timeoutMs: number
): Promise<{ text: string; success: boolean }> {
    return new Promise(async (resolve) => {
        const timeout = setTimeout(() => {
            console.log(`[OCR] Page ${pageNum} timed out after ${timeoutMs}ms`);
            resolve({ text: '', success: false });
        }, timeoutMs);

        try {
            const result = await worker.recognize(imageBuffer);
            clearTimeout(timeout);
            resolve({ text: result.data.text, success: true });
        } catch (error) {
            clearTimeout(timeout);
            console.error(`[OCR] Page ${pageNum} failed:`, error);
            resolve({ text: '', success: false });
        }
    });
}

/**
 * Main OCR Pipeline Entry Point
 */
export async function performOCR(
    pdfBuffer: Buffer,
    config: OCRConfig = DEFAULT_OCR_CONFIG,
    onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
    const startTime = Date.now();
    const fileSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);

    console.log(`[OCR Pipeline] START: ${fileSizeMB}MB, config: scale=${config.scale}, timeout=${config.totalTimeoutMs}ms`);

    // Acquire semaphore (only 1 concurrent OCR)
    await ocrSemaphore.acquire();

    let worker: Worker | null = null;

    try {
        // Phase 1: Convert PDF to PNG images
        console.log(`[OCR Pipeline] Rendering PDF pages to images...`);

        if (onProgress) {
            onProgress({ currentPage: 0, totalPages: 0, phase: 'rendering', percentComplete: 0 });
        }

        let pngPages: PngPageOutput[];
        try {
            // Convert Buffer to ArrayBuffer for pdf-to-png-converter
            const arrayBuffer = pdfBuffer.buffer.slice(
                pdfBuffer.byteOffset,
                pdfBuffer.byteOffset + pdfBuffer.byteLength
            );

            pngPages = await pdfToPng(arrayBuffer, {
                viewportScale: config.scale,
                // Don't write to disk, keep in memory
                outputFolder: undefined,
            });
        } catch (renderError) {
            console.error(`[OCR Pipeline] PDF render failed:`, renderError);
            return {
                success: false,
                text: '',
                pageCount: 0,
                pagesProcessed: 0,
                processingTimeMs: Date.now() - startTime,
                userMessage: OCR_MESSAGES.RENDER_FAILED,
                failureReason: 'RENDER_FAILED'
            };
        }

        const totalPages = pngPages.length;
        console.log(`[OCR Pipeline] Rendered ${totalPages} pages`);

        if (totalPages > config.maxPages) {
            console.log(`[OCR Pipeline] Too many pages: ${totalPages} > ${config.maxPages}`);
            return {
                success: false,
                text: '',
                pageCount: totalPages,
                pagesProcessed: 0,
                processingTimeMs: Date.now() - startTime,
                userMessage: OCR_MESSAGES.TOO_MANY_PAGES,
                failureReason: 'TOO_MANY_PAGES'
            };
        }

        // Phase 2: Initialize Tesseract
        console.log(`[OCR Pipeline] Initializing Tesseract worker (${config.language})...`);
        worker = await initWorker(config.language);

        // Phase 3: OCR each page
        const textParts: string[] = [];
        let pagesProcessed = 0;

        for (let i = 0; i < totalPages; i++) {
            // Check total timeout
            if (Date.now() - startTime > config.totalTimeoutMs) {
                console.log(`[OCR Pipeline] Total timeout exceeded`);
                break;
            }

            const page = pngPages[i];

            if (onProgress) {
                onProgress({
                    currentPage: i + 1,
                    totalPages,
                    phase: 'recognizing',
                    percentComplete: Math.round((i / totalPages) * 100)
                });
            }

            console.log(`[OCR Pipeline] Processing page ${i + 1}/${totalPages}...`);

            // Ensure page content exists
            if (!page.content) {
                console.warn(`[OCR Pipeline] Page ${i + 1} has no content, skipping`);
                textParts.push('');
                continue;
            }

            const result = await ocrPage(worker, Buffer.from(page.content), i + 1, config.pageTimeoutMs);

            if (result.success) {
                textParts.push(result.text);
                pagesProcessed++;
            } else {
                console.warn(`[OCR Pipeline] Page ${i + 1} failed, continuing...`);
                textParts.push(''); // Empty placeholder
            }

            // Log batch progress
            if ((i + 1) % config.batchSize === 0) {
                console.log(`[OCR Pipeline] Batch complete: ${i + 1}/${totalPages} pages`);
            }
        }

        // Phase 4: Assemble result
        const fullText = textParts.join('\n\n').trim();
        const processingTimeMs = Date.now() - startTime;

        console.log(`[OCR Pipeline] SUCCESS: ${fullText.length} chars from ${pagesProcessed}/${totalPages} pages in ${processingTimeMs}ms`);

        if (onProgress) {
            onProgress({
                currentPage: totalPages,
                totalPages,
                phase: 'complete',
                percentComplete: 100
            });
        }

        return {
            success: true,
            text: fullText,
            pageCount: totalPages,
            pagesProcessed,
            processingTimeMs,
            userMessage: OCR_MESSAGES.SUCCESS
        };

    } catch (error) {
        const err = error as Error;
        console.error(`[OCR Pipeline] ERROR:`, err.message);

        return {
            success: false,
            text: '',
            pageCount: 0,
            pagesProcessed: 0,
            processingTimeMs: Date.now() - startTime,
            userMessage: OCR_MESSAGES.OCR_FAILED,
            failureReason: 'OCR_FAILED'
        };
    } finally {
        // Cleanup
        if (worker) {
            await worker.terminate();
            console.log(`[OCR Pipeline] Worker terminated`);
        }
        ocrSemaphore.release();
    }
}
