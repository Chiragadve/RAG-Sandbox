import { createWorker } from 'tesseract.js';
import { createCanvas, Image, ImageData } from 'canvas';
import path from 'path';
import { pathToFileURL } from 'url';

// 1. Force Polyfills immediately (before any PDF.js code loads)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny = global as any;
globalAny.Image = Image;
globalAny.Canvas = createCanvas;
globalAny.ImageData = ImageData;

// NodeCanvasFactory to bridge pdf.js and node-canvas
class NodeCanvasFactory {
    create(width: number, height: number) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (width <= 0 || height <= 0) {
            throw new Error("Invalid canvas size");
        }
        const canvas = createCanvas(width, height);
        const context = canvas.getContext("2d");
        return {
            canvas,
            context,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reset(canvasAndContext: any, width: number, height: number) {
        if (!canvasAndContext.canvas) throw new Error("Canvas is not specified");
        if (width <= 0 || height <= 0) {
            throw new Error("Invalid canvas size");
        }
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destroy(canvasAndContext: any) {
        if (!canvasAndContext.canvas) throw new Error("Canvas is not specified");
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}

export async function performOCR(buffer: Buffer): Promise<string> {
    console.log("Starting OCR processing...");

    // 2. Dynamic Import to ensure globals are seen by PDF.js
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Set up worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).toString();

    let worker = null;
    try {
        // Explicitly point to the Node.js specific worker script
        const workerPath = path.join(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js');

        // Initialize worker
        worker = await createWorker('eng', 1, {
            workerPath: workerPath
        });

        // Convert Buffer
        const data = new Uint8Array(buffer);

        // Load PDF
        const loadingTask = pdfjsLib.getDocument({
            data,
            canvasFactory: new NodeCanvasFactory(),
            fontExtraProperties: true
        } as any);
        const pdfDocument = await loadingTask.promise;

        let fullText = "";

        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });

            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            await page.render({
                canvasContext: context as any,
                viewport: viewport as any
            }).promise;

            const imageBuffer = canvas.toBuffer('image/png') as any;
            const { data: { text } } = await worker.recognize(imageBuffer);
            fullText += text + "\n";
            console.log(`OCR Page ${i}/${pdfDocument.numPages} complete.`);

            page.cleanup();
        }

        return fullText;
    } catch (error) {
        console.error("OCR Failed:", error);
        return "";
    } finally {
        if (worker) {
            await worker.terminate();
        }
    }
}
