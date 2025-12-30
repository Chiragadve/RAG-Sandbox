import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';
import path from 'path';
import { pathToFileURL } from 'url';

// Set up pdfjs-dist worker for Node.js environment
// We point directly to the file in node_modules to avoid Webpack bundling issues in Next.js server
// We must use a file:// URL for Windows compatibility with Node's ESM loader
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).toString();

export async function performOCR(buffer: Buffer): Promise<string> {
    console.log("Starting OCR processing...");
    let worker = null;
    try {
        // Explicitly point to the Node.js specific worker script
        // The default discovery often fails in bundled environments (Next.js server)
        // And dist/worker.min.js is for browsers (causes addEventListener error)
        const workerPath = path.join(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js');

        // Initialize worker with English language and default OEM (1)
        // Pass workerPath to ensure it can be found
        worker = await createWorker('eng', 1, {
            workerPath: workerPath
        });

        // Convert Buffer to Uint8Array/ArrayBuffer for pdfjs-dist
        const data = new Uint8Array(buffer);

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
            data,
            fontExtraProperties: true // Optional: sometimes helps with fonts
        });
        const pdfDocument = await loadingTask.promise;

        let fullText = "";

        // Process each page
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);

            // Set scale higher for better OCR accuracy
            const viewport = page.getViewport({ scale: 2.0 });

            // Create canvas for rendering
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            // Render PDF page into canvas context
            await page.render({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                canvasContext: context as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                viewport: viewport as any
            } as any).promise;

            // Get image buffer from canvas
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const imageBuffer = canvas.toBuffer('image/png') as any;

            // Perform OCR on the image buffer using the persistent worker
            const { data: { text } } = await worker.recognize(imageBuffer);
            fullText += text + "\n";
            console.log(`OCR Page ${i}/${pdfDocument.numPages} complete.`);

            // Cleanup page resources
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
