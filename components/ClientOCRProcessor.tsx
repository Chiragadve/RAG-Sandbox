'use client'

import { useState, useEffect, useCallback } from 'react'
import { createWorker, Worker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker for browser
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

interface OCRProgress {
    currentPage: number
    totalPages: number
    phase: 'loading' | 'rendering' | 'recognizing' | 'complete'
    percentComplete: number
}

interface ClientOCRProcessorProps {
    file: File
    onComplete: (text: string) => void
    onError: (error: string) => void
    onCancel?: () => void
}

export default function ClientOCRProcessor({
    file,
    onComplete,
    onError,
    onCancel
}: ClientOCRProcessorProps) {
    const [progress, setProgress] = useState<OCRProgress>({
        currentPage: 0,
        totalPages: 0,
        phase: 'loading',
        percentComplete: 0
    })
    const [isProcessing, setIsProcessing] = useState(true)

    const processOCR = useCallback(async () => {
        let worker: Worker | null = null

        try {
            // Load PDF
            setProgress(p => ({ ...p, phase: 'loading', percentComplete: 5 }))

            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
            const totalPages = pdf.numPages

            setProgress(p => ({ ...p, totalPages, percentComplete: 10 }))

            // Initialize Tesseract worker
            worker = await createWorker('eng', 1, {
                logger: () => { } // Suppress logging
            })

            const textParts: string[] = []

            // Process each page
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                // Render page to canvas
                setProgress({
                    currentPage: pageNum,
                    totalPages,
                    phase: 'rendering',
                    percentComplete: 10 + ((pageNum - 1) / totalPages) * 80
                })

                const page = await pdf.getPage(pageNum)
                const scale = 2.0 // Higher scale = better OCR accuracy
                const viewport = page.getViewport({ scale })

                // Create offscreen canvas
                const canvas = document.createElement('canvas')
                const context = canvas.getContext('2d')!
                canvas.height = viewport.height
                canvas.width = viewport.width

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise

                // OCR the rendered page
                setProgress(p => ({ ...p, phase: 'recognizing' }))

                const { data: { text } } = await worker.recognize(canvas)
                textParts.push(text)

                // Clean up canvas
                canvas.width = 0
                canvas.height = 0

                setProgress({
                    currentPage: pageNum,
                    totalPages,
                    phase: 'recognizing',
                    percentComplete: 10 + (pageNum / totalPages) * 80
                })
            }

            // Complete
            setProgress({
                currentPage: totalPages,
                totalPages,
                phase: 'complete',
                percentComplete: 100
            })

            const fullText = textParts.join('\n\n').trim()

            if (!fullText || fullText.length < 10) {
                onError('No text could be extracted from this PDF')
                return
            }

            onComplete(fullText)

        } catch (err) {
            const error = err as Error
            console.error('[ClientOCR] Error:', error)
            onError(error.message || 'OCR processing failed')
        } finally {
            if (worker) {
                await worker.terminate()
            }
            setIsProcessing(false)
        }
    }, [file, onComplete, onError])

    useEffect(() => {
        processOCR()
    }, [processOCR])

    // Progress bar colors
    const getPhaseColor = () => {
        switch (progress.phase) {
            case 'loading': return 'bg-blue-500'
            case 'rendering': return 'bg-amber-500'
            case 'recognizing': return 'bg-primary'
            case 'complete': return 'bg-green-500'
            default: return 'bg-primary'
        }
    }

    const getPhaseText = () => {
        switch (progress.phase) {
            case 'loading': return 'Loading PDF...'
            case 'rendering': return `Rendering page ${progress.currentPage}/${progress.totalPages}...`
            case 'recognizing': return `OCR page ${progress.currentPage}/${progress.totalPages}...`
            case 'complete': return 'Complete!'
            default: return 'Processing...'
        }
    }

    return (
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
            {/* Header with cancel */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                    {file.name}
                </span>
                {onCancel && isProcessing && (
                    <button
                        onClick={onCancel}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full ${getPhaseColor()} transition-all duration-300 ease-out`}
                    style={{ width: `${progress.percentComplete}%` }}
                />
            </div>

            {/* Status text */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{getPhaseText()}</span>
                <span>{Math.round(progress.percentComplete)}%</span>
            </div>
        </div>
    )
}
