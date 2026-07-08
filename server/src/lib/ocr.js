/**
 * OCR is optional. tesseract.js downloads language data on first run,
 * so it needs internet the first time. If it isn't installed or fails,
 * documents simply won't have searchable text — everything else works.
 */
export async function extractText(filePath) {
  try {
    const { createWorker } = await import("tesseract.js");
    // tesseract.js throws synchronously from its internal message handler on
    // worker rejection unless an errorHandler is supplied — without this,
    // an unsupported file (e.g. a PDF) crashes the whole process instead of
    // rejecting the recognize() promise.
    let workerError = null;
    const worker = await createWorker("eng", undefined, {
      errorHandler: (err) => { workerError = err; },
    });
    if (workerError) throw new Error(workerError.message || String(workerError));
    const {
      data: { text },
    } = await worker.recognize(filePath);
    await worker.terminate();
    if (workerError) throw new Error(workerError.message || String(workerError));
    return (text || "").trim();
  } catch (err) {
    console.warn("[ocr] skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}
