import { getDocumentProxy } from "unpdf";
import { FileRejected } from "./docx";

/**
 * PDF to text with unpdf (pdf.js, serverless build): no font loading, no rendering. The first `maxPages` pages
 * only, each page's text in reading order with pdf.js's own line breaks. Runs inside the extraction thread.
 */
export async function pdfText(bytes: Uint8Array, maxPages: number, maxChars = Infinity): Promise<{ text: string; pages: number }> {
  let doc;
  try {
    // A copy: pdf.js transfers (detaches) the buffer it is given.
    // pdf.js 5 dropped its eval path (and the isEvalSupported option); the bundle has no Function constructor call.
    doc = await getDocumentProxy(new Uint8Array(bytes), {
      disableFontFace: true,
      useSystemFonts: false,
      enableXfa: false,
      stopAtErrors: false,
      verbosity: 0,
    });
  } catch (err) {
    const name = (err as { name?: string }).name;
    throw new FileRejected(name === "PasswordException" ? "pdf_encrypted" : "pdf_corrupt");
  }
  try {
    const pages = Math.min(doc.numPages, maxPages);
    const parts: string[] = [];
    let total = 0;
    // The budget stops reading pages, so a huge text layer is never built in the thread (Security-reviewer-B).
    for (let n = 1; n <= pages && total < maxChars; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : "");
      }
      parts.push(text);
      total += text.length + 1;
      page.cleanup();
    }
    return { text: parts.join("\n"), pages };
  } catch {
    throw new FileRejected("pdf_corrupt");
  } finally {
    await doc.loadingTask.destroy();
  }
}
