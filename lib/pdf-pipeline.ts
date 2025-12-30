/**
 * Production PDF Pipeline
 * 
 * End-to-end PDF ingestion following production principles:
 * - Classification before extraction
 * - Deterministic pipelines (no trial-and-error)
 * - Bounded memory and time
 * - Page-batched processing
 * - Clear user-facing states
 * - NO PDF.js (server-incompatible)
 */

import PDFParser from 'pdf2json';

// OCR is loaded dynamically to avoid native binding issues at module load time

// ============================================================================
// Configuration
// ============================================================================

export interface PipelineConfig {
    maxSizeBytes: number;
    timeoutMs: number;
    batchSize: number;
    classificationPages: number;
    minTextThreshold: number;
    mixedTextRatio: number;  // Ratio below which a page is considered low-text

    // Type-specific page limits
    maxPagesTextBased: number;     // Max pages for TEXT_BASED (sync)
    maxPagesScannedSync: number;   // Max pages for SCANNED (sync OCR)
    maxPagesScannedAsync: number;  // Max pages for SCANNED (async OCR job)

    // Time budgets
    syncTimeoutMs: number;         // Sync extraction timeout

    // OCR opt-in
    ocrEnabled: boolean;           // Must be explicitly true for OCR to run
}

export const DEFAULT_CONFIG: PipelineConfig = {
    maxSizeBytes: 50 * 1024 * 1024,  // 50MB
    timeoutMs: 30_000,                // 30 seconds (sync budget)
    batchSize: 10,                    // pages per batch
    classificationPages: 5,           // pages to sample for classification
    minTextThreshold: 100,            // minimum total chars to consider text-based
    mixedTextRatio: 0.3,              // if <30% of pages have text, consider MIXED

    // Type-specific page limits
    maxPagesTextBased: 200,          // TEXT_BASED: max 200 pages
    maxPagesScannedSync: 30,         // SCANNED: max 30 pages for sync OCR
    maxPagesScannedAsync: 100,       // SCANNED: max 100 pages for async OCR

    // Time budgets
    syncTimeoutMs: 30_000,           // 30 seconds for sync extraction

    // OCR opt-in (default OFF - must be explicitly enabled)
    ocrEnabled: false,
};

// ============================================================================
// Types (Unified Extraction Contract)
// ============================================================================

export type PDFClassification =
    | 'TEXT_BASED'
    | 'SCANNED'
    | 'MIXED'
    | 'ENCRYPTED'
    | 'CORRUPTED';

export type ExtractionSource = 'pdf2json' | 'ocr' | 'hybrid';

/**
 * Unified extraction result - all pipelines return this structure
 */
export interface ExtractedDocument {
    success: boolean;
    text: string;
    pageCount: number;
    source: ExtractionSource;
    classification: PDFClassification;
    processingTimeMs: number;
    // User-facing message (never stack traces)
    userMessage: string;
    // Warnings collected during extraction (non-fatal issues)
    warnings?: string[];
    // Optional: only set on failure
    failureReason?: 'SCANNED' | 'ENCRYPTED' | 'CORRUPTED' | 'TIMEOUT' | 'TOO_LARGE' | 'EMPTY' | 'TOO_MANY_PAGES';

    // OCR opt-in flow
    requiresOCR?: boolean;
    ocrEstimate?: {
        estimatedTimeSeconds: number;
        pageCount: number;
        warning: string;
        canRunSync: boolean;  // true if under sync page limit
    };

    // Extraction completeness status
    extractionStatus?: 'COMPLETE' | 'PARTIAL' | 'REQUIRES_OCR';
}

export interface ExtractionProgress {
    currentPage: number;
    totalPages: number;
    currentBatch: number;
    totalBatches: number;
    extractedChars: number;
    phase: 'validating' | 'classifying' | 'extracting' | 'complete';
}

interface ClassificationResult {
    type: PDFClassification;
    pageCount: number;
    totalTextLength: number;
    pagesWithText: number;
    textDensity: number;  // ratio of pages with meaningful text
}

// ============================================================================
// User-Facing Messages (Never show stack traces)
// ============================================================================

const USER_MESSAGES: Record<string, string> = {
    TEXT_BASED_SUCCESS: 'Text extracted successfully',
    SCANNED: 'This PDF requires OCR to extract text. OCR is not yet available.',
    SCANNED_OCR_REQUIRED: 'This PDF is scanned and requires OCR. Click "Run OCR" to extract text.',
    MIXED: 'This PDF contains a mix of text and scanned pages. Partial text extracted.',
    MIXED_PARTIAL: 'Extracted text from text-based pages. Some scanned pages could not be processed without OCR.',
    ENCRYPTED: 'This PDF is password-protected and cannot be processed.',
    CORRUPTED: 'This file is not a valid PDF or is corrupted.',
    TIMEOUT: 'Processing timed out. The PDF may be too complex.',
    TOO_LARGE: 'File size exceeds the maximum allowed (50MB).',
    TOO_MANY_PAGES_TEXT: 'PDF has too many pages for text extraction. Maximum is 200 pages.',
    TOO_MANY_PAGES_OCR_SYNC: 'PDF has too many pages for sync OCR. Maximum is 30 pages. Try async OCR.',
    TOO_MANY_PAGES_OCR_ASYNC: 'PDF has too many pages for OCR. Maximum is 100 pages.',
    EMPTY: 'No text could be extracted from this PDF.',
    PROCESSING: 'Processing document...',
    OCR_DISABLED: 'OCR is disabled. Enable OCR to process scanned documents.',
};

// ============================================================================
// OCR Estimate Helper
// ============================================================================

/**
 * Estimate OCR processing time and provide user warning
 */
export function estimateOCR(
    pageCount: number,
    config: PipelineConfig
): { estimatedTimeSeconds: number; pageCount: number; warning: string; canRunSync: boolean } {
    // ~10 seconds per page is a rough estimate for Tesseract.js
    const estimatedTimeSeconds = pageCount * 10;
    const canRunSync = pageCount <= config.maxPagesScannedSync;

    let warning: string;
    if (pageCount > config.maxPagesScannedAsync) {
        warning = `This document has ${pageCount} pages, exceeding the maximum of ${config.maxPagesScannedAsync} pages for OCR.`;
    } else if (canRunSync) {
        warning = `OCR will take approximately ${Math.ceil(estimatedTimeSeconds / 60)} minute(s) for ${pageCount} pages.`;
    } else {
        warning = `OCR will run as a background job (~${Math.ceil(estimatedTimeSeconds / 60)} minutes for ${pageCount} pages).`;
    }

    return {
        estimatedTimeSeconds,
        pageCount,
        warning,
        canRunSync,
    };
}

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

// Global semaphore: max 2 concurrent PDF extractions
const extractionSemaphore = new Semaphore(2);

// ============================================================================
// Phase 0: System Guardrails
// ============================================================================

function validatePDF(
    buffer: Buffer,
    config: PipelineConfig
): { valid: boolean; failureReason?: string; userMessage?: string } {
    // Check file size
    if (buffer.length > config.maxSizeBytes) {
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        console.log(`[Guardrails] REJECTED: File size ${sizeMB}MB exceeds limit`);
        return {
            valid: false,
            failureReason: 'TOO_LARGE',
            userMessage: USER_MESSAGES.TOO_LARGE
        };
    }

    // Check PDF header (magic bytes)
    const header = buffer.slice(0, 8).toString('utf-8');
    if (!header.startsWith('%PDF')) {
        console.log(`[Guardrails] REJECTED: Invalid PDF header`);
        return {
            valid: false,
            failureReason: 'CORRUPTED',
            userMessage: USER_MESSAGES.CORRUPTED
        };
    }

    return { valid: true };
}

// ============================================================================
// Phase 1: Cheap Classification Pass
// ============================================================================

async function classifyPDF(
    buffer: Buffer,
    config: PipelineConfig
): Promise<ClassificationResult> {
    return new Promise((resolve) => {
        const pdfParser = new PDFParser(null, true);
        let resolved = false;
        const warnings: string[] = [];

        // Fast timeout for classification (10 seconds max)
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log(`[Classification] TIMEOUT after 10s`);
                resolve({
                    type: 'CORRUPTED',
                    pageCount: 0,
                    totalTextLength: 0,
                    pagesWithText: 0,
                    textDensity: 0
                });
            }
        }, 10000);

        // Collect warnings - these are NOT fatal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfParser.on("pdfParser_dataError", (errData: any) => {
            // Only log, don't resolve as CORRUPTED yet
            // pdf2json will still emit dataReady if it can extract some data
            const message = errData?.parserError?.message || errData?.message || 'Unknown parse error';
            warnings.push(message);
            console.log(`[Classification] Warning (non-fatal): ${message}`);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);

            // Log any warnings collected
            if (warnings.length > 0) {
                console.log(`[Classification] Collected ${warnings.length} warnings (ignored for classification)`);
            }

            try {
                const pages = pdfData?.Pages || [];
                const pageCount = pages.length;

                // ONLY zero pages = CORRUPTED
                if (pageCount === 0) {
                    console.log(`[Classification] Zero pages detected - CORRUPTED`);
                    resolve({
                        type: 'CORRUPTED',
                        pageCount: 0,
                        totalTextLength: 0,
                        pagesWithText: 0,
                        textDensity: 0
                    });
                    return;
                }

                // Sample first N pages
                const samplesToCheck = Math.min(config.classificationPages, pageCount);
                let totalTextLength = 0;
                let pagesWithText = 0;

                for (let i = 0; i < samplesToCheck; i++) {
                    const page = pages[i];
                    let pageTextLength = 0;

                    if (page?.Texts) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        page.Texts.forEach((t: any) => {
                            if (t.R?.[0]?.T) {
                                try {
                                    const text = decodeURIComponent(t.R[0].T);
                                    pageTextLength += text.length;
                                } catch {
                                    // Ignore decode errors
                                }
                            }
                        });
                    }

                    totalTextLength += pageTextLength;
                    if (pageTextLength > 20) {  // Page has meaningful text
                        pagesWithText++;
                    }
                }

                const textDensity = samplesToCheck > 0 ? pagesWithText / samplesToCheck : 0;

                // Classification rules (no guessing)
                // Warnings do NOT affect classification
                let type: PDFClassification;
                if (totalTextLength === 0) {
                    type = 'SCANNED';
                } else if (textDensity < config.mixedTextRatio) {
                    type = 'MIXED';
                } else if (totalTextLength < config.minTextThreshold) {
                    type = 'SCANNED';
                } else {
                    type = 'TEXT_BASED';
                }

                console.log(`[Classification] ${type}: ${pageCount} pages, ${totalTextLength} chars, ${(textDensity * 100).toFixed(0)}% text density`);

                resolve({
                    type,
                    pageCount,
                    totalTextLength,
                    pagesWithText,
                    textDensity
                });
            } catch (e) {
                // Hard parse error in our code - still try to not mark as CORRUPTED
                console.error(`[Classification] Exception during classification:`, e);
                resolve({
                    type: 'CORRUPTED',
                    pageCount: 0,
                    totalTextLength: 0,
                    pagesWithText: 0,
                    textDensity: 0
                });
            }
        });

        // Handle case where pdf2json never emits dataReady (hard failure)
        // This is rare - timeout will catch it anyway
        pdfParser.parseBuffer(buffer);
    });
}

// ============================================================================
// Phase 3A: Text Extraction Pipeline (TEXT_BASED)
// ============================================================================

async function extractTextPipeline(
    buffer: Buffer,
    pageCount: number,
    config: PipelineConfig,
    onProgress?: (progress: ExtractionProgress) => void
): Promise<{ text: string; success: boolean }> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true);
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                reject(new Error('TIMEOUT'));
            }
        }, config.timeoutMs);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfParser.on("pdfParser_dataError", (errData: any) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                reject(new Error(errData?.parserError?.message || 'Parse failed'));
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);

            try {
                const pages = pdfData?.Pages || [];
                const totalPages = pages.length;

                if (totalPages > config.maxPagesTextBased) {
                    reject(new Error('TOO_MANY_PAGES'));
                    return;
                }

                const totalBatches = Math.ceil(totalPages / config.batchSize);
                const textParts: string[] = [];
                let extractedChars = 0;

                // Page-batched extraction
                for (let batch = 0; batch < totalBatches; batch++) {
                    const startIdx = batch * config.batchSize;
                    const endIdx = Math.min(startIdx + config.batchSize, totalPages);

                    for (let i = startIdx; i < endIdx; i++) {
                        const page = pages[i];
                        let pageText = '';

                        if (page?.Texts) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            page.Texts.forEach((t: any) => {
                                if (t.R?.[0]?.T) {
                                    try {
                                        pageText += decodeURIComponent(t.R[0].T) + ' ';
                                    } catch {
                                        // URI malformed - ignore this text element
                                        // Common in PDFs with special characters
                                    }
                                }
                            });
                        }

                        textParts.push(pageText.trim());
                        extractedChars += pageText.length;

                        if (onProgress) {
                            onProgress({
                                currentPage: i + 1,
                                totalPages,
                                currentBatch: batch + 1,
                                totalBatches,
                                extractedChars,
                                phase: 'extracting'
                            });
                        }
                    }

                    console.log(`[TextPipeline] Batch ${batch + 1}/${totalBatches} (pages ${startIdx + 1}-${endIdx})`);
                }

                // Assemble and clean
                const fullText = textParts.join('\n').trim();
                const cleanedText = fullText.replace(/----------------Page \(\d+\) Break----------------/g, '');

                resolve({ text: cleanedText, success: true });
            } catch (e) {
                reject(e);
            }
        });

        pdfParser.parseBuffer(buffer);
    });
}

// ============================================================================
// Main Pipeline Entry Point
// ============================================================================

export async function extractPDFText(
    buffer: Buffer,
    config: PipelineConfig = DEFAULT_CONFIG,
    onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractedDocument> {
    const startTime = Date.now();
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);

    console.log(`[PDFPipeline] START: ${fileSizeMB}MB`);

    // Phase 0: Guardrails
    const validation = validatePDF(buffer, config);
    if (!validation.valid) {
        return {
            success: false,
            text: '',
            pageCount: 0,
            source: 'pdf2json',
            classification: 'CORRUPTED',
            processingTimeMs: Date.now() - startTime,
            userMessage: validation.userMessage || USER_MESSAGES.CORRUPTED,
            failureReason: validation.failureReason as ExtractedDocument['failureReason']
        };
    }

    // Acquire semaphore (concurrency control)
    await extractionSemaphore.acquire();

    try {
        if (onProgress) {
            onProgress({ currentPage: 0, totalPages: 0, currentBatch: 0, totalBatches: 0, extractedChars: 0, phase: 'classifying' });
        }

        // Phase 1: Classification
        const classification = await classifyPDF(buffer, config);

        // Phase 2: Pipeline Selection (deterministic, no fallbacks)
        switch (classification.type) {
            case 'ENCRYPTED':
                console.log(`[PDFPipeline] ENCRYPTED - cannot process`);
                return {
                    success: false,
                    text: '',
                    pageCount: classification.pageCount,
                    source: 'pdf2json',
                    classification: 'ENCRYPTED',
                    processingTimeMs: Date.now() - startTime,
                    userMessage: USER_MESSAGES.ENCRYPTED,
                    failureReason: 'ENCRYPTED'
                };

            case 'CORRUPTED':
                console.log(`[PDFPipeline] CORRUPTED - cannot process`);
                return {
                    success: false,
                    text: '',
                    pageCount: 0,
                    source: 'pdf2json',
                    classification: 'CORRUPTED',
                    processingTimeMs: Date.now() - startTime,
                    userMessage: USER_MESSAGES.CORRUPTED,
                    failureReason: 'CORRUPTED'
                };

            case 'SCANNED':
                console.log(`[PDFPipeline] SCANNED - ${config.ocrEnabled ? 'OCR enabled' : 'OCR disabled (opt-in required)'}`);

                // Check page limits for SCANNED documents
                if (classification.pageCount > config.maxPagesScannedAsync) {
                    console.log(`[PDFPipeline] REJECTED: Too many pages for OCR (${classification.pageCount} > ${config.maxPagesScannedAsync})`);
                    return {
                        success: false,
                        text: '',
                        pageCount: classification.pageCount,
                        source: 'pdf2json',
                        classification: 'SCANNED',
                        processingTimeMs: Date.now() - startTime,
                        userMessage: USER_MESSAGES.TOO_MANY_PAGES_OCR_ASYNC,
                        failureReason: 'TOO_MANY_PAGES',
                        requiresOCR: true,
                        extractionStatus: 'REQUIRES_OCR',
                    };
                }

                // If OCR is not explicitly enabled, return classification with estimate
                if (!config.ocrEnabled) {
                    const ocrEstimate = estimateOCR(classification.pageCount, config);
                    console.log(`[PDFPipeline] OCR not enabled - returning estimate: ${ocrEstimate.estimatedTimeSeconds}s`);
                    return {
                        success: false,
                        text: '',
                        pageCount: classification.pageCount,
                        source: 'pdf2json',
                        classification: 'SCANNED',
                        processingTimeMs: Date.now() - startTime,
                        userMessage: USER_MESSAGES.SCANNED_OCR_REQUIRED,
                        requiresOCR: true,
                        ocrEstimate,
                        extractionStatus: 'REQUIRES_OCR',
                    };
                }

                // OCR is enabled - check sync limits
                if (classification.pageCount > config.maxPagesScannedSync) {
                    console.log(`[PDFPipeline] Too many pages for sync OCR (${classification.pageCount} > ${config.maxPagesScannedSync}) - async required`);
                    const ocrEstimate = estimateOCR(classification.pageCount, config);
                    return {
                        success: false,
                        text: '',
                        pageCount: classification.pageCount,
                        source: 'pdf2json',
                        classification: 'SCANNED',
                        processingTimeMs: Date.now() - startTime,
                        userMessage: USER_MESSAGES.TOO_MANY_PAGES_OCR_SYNC,
                        requiresOCR: true,
                        ocrEstimate,
                        extractionStatus: 'REQUIRES_OCR',
                    };
                }

                // OCR enabled and within sync limits - perform OCR
                try {
                    const { performOCR } = await import('./ocr-pipeline');

                    const ocrResult = await performOCR(buffer, undefined, (ocrProgress) => {
                        if (onProgress) {
                            onProgress({
                                currentPage: ocrProgress.currentPage,
                                totalPages: ocrProgress.totalPages,
                                currentBatch: 0,
                                totalBatches: 0,
                                extractedChars: 0,
                                phase: 'extracting'
                            });
                        }
                    });

                    return {
                        success: ocrResult.success,
                        text: ocrResult.text,
                        pageCount: ocrResult.pageCount,
                        source: 'ocr' as ExtractionSource,
                        classification: 'SCANNED',
                        processingTimeMs: Date.now() - startTime,
                        userMessage: ocrResult.userMessage,
                        failureReason: ocrResult.success ? undefined : (ocrResult.failureReason as ExtractedDocument['failureReason']),
                        extractionStatus: ocrResult.success ? 'COMPLETE' : 'REQUIRES_OCR',
                    };
                } catch (ocrLoadError) {
                    console.error('[PDFPipeline] OCR module failed to load:', ocrLoadError);
                    return {
                        success: false,
                        text: '',
                        pageCount: classification.pageCount,
                        source: 'pdf2json' as ExtractionSource,
                        classification: 'SCANNED',
                        processingTimeMs: Date.now() - startTime,
                        userMessage: 'This PDF requires OCR but the OCR module is not available. Please run: npm i after removing node_modules and package-lock.json',
                        failureReason: 'SCANNED',
                        requiresOCR: true,
                        extractionStatus: 'REQUIRES_OCR',
                    };
                }
                break;

            case 'MIXED':
                // For MIXED, we extract what we can with text pipeline
                // In future: hybrid pipeline with selective OCR
                console.log(`[PDFPipeline] MIXED - extracting available text`);
                break;

            case 'TEXT_BASED':
                console.log(`[PDFPipeline] TEXT_BASED - using text pipeline`);
                break;
        }

        // Phase 3: Text Extraction
        if (onProgress) {
            onProgress({ currentPage: 0, totalPages: classification.pageCount, currentBatch: 0, totalBatches: 0, extractedChars: 0, phase: 'extracting' });
        }

        const result = await extractTextPipeline(buffer, classification.pageCount, config, onProgress);

        if (!result.text || result.text.trim().length < 10) {
            console.log(`[PDFPipeline] EMPTY - no meaningful text extracted`);
            return {
                success: false,
                text: '',
                pageCount: classification.pageCount,
                source: 'pdf2json',
                classification: classification.type,
                processingTimeMs: Date.now() - startTime,
                userMessage: USER_MESSAGES.EMPTY,
                failureReason: 'EMPTY'
            };
        }

        const processingTimeMs = Date.now() - startTime;
        console.log(`[PDFPipeline] SUCCESS: ${result.text.length} chars from ${classification.pageCount} pages in ${processingTimeMs}ms`);

        if (onProgress) {
            onProgress({ currentPage: classification.pageCount, totalPages: classification.pageCount, currentBatch: 0, totalBatches: 0, extractedChars: result.text.length, phase: 'complete' });
        }

        return {
            success: true,
            text: result.text,
            pageCount: classification.pageCount,
            source: 'pdf2json',
            classification: classification.type,
            processingTimeMs,
            userMessage: classification.type === 'MIXED'
                ? USER_MESSAGES.MIXED_PARTIAL
                : USER_MESSAGES.TEXT_BASED_SUCCESS,
            extractionStatus: classification.type === 'MIXED' ? 'PARTIAL' : 'COMPLETE',
        };

    } catch (error) {
        const err = error as Error;
        const processingTimeMs = Date.now() - startTime;
        console.error(`[PDFPipeline] ERROR: ${err.message}`);

        // Map errors to user-facing messages
        let userMessage = USER_MESSAGES.CORRUPTED;
        let failureReason: ExtractedDocument['failureReason'] = 'CORRUPTED';

        if (err.message === 'TIMEOUT') {
            userMessage = USER_MESSAGES.TIMEOUT;
            failureReason = 'TIMEOUT';
        } else if (err.message === 'TOO_MANY_PAGES') {
            userMessage = USER_MESSAGES.TOO_MANY_PAGES_TEXT;
            failureReason = 'TOO_MANY_PAGES';
        }

        return {
            success: false,
            text: '',
            pageCount: 0,
            source: 'pdf2json',
            classification: 'CORRUPTED',
            processingTimeMs,
            userMessage,
            failureReason
        };
    } finally {
        extractionSemaphore.release();
    }
}
