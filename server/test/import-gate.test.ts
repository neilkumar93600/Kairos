import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DOCX_LIMITS, FileRejected, decodeXmlText, docxText, documentXmlToText, stripBlocks } from "../src/services/import/docx";
import { pdfText } from "../src/services/import/pdf";
import { ImportRejected, IMPORT_MAX_BYTES, extractFile, runThread, sniff } from "../src/services/import/extract";
import { capChars, contactIn, isLinkedInExport, normalizeSource, sourceHash } from "../src/services/import/source";
import { DOCX_TYPES, RESUME_LINES, docx, documentXml, pdf, zip } from "./helpers/files";

/**
 * The untrusted-file gate of CISO mustFix 8 and its fuzz corpus. Every hostile file below is refused with a 4xx, the
 * api process survives, and nothing hangs past the thread's kill. Runs in every CI build (no database, no network).
 */

const OPTS = { maxPages: 10, maxChars: 40_000 };
const rejection = async (bytes: Uint8Array) => {
  try {
    await extractFile(bytes, OPTS);
  } catch (err) {
    expect(err).toBeInstanceOf(ImportRejected);
    const e = err as ImportRejected;
    return { status: e.status, code: e.code, reason: (e.details as { reason?: string } | undefined)?.reason };
  }
  throw new Error("expected a rejection");
};
const reasonOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    if (err instanceof FileRejected) return err.reason;
    throw err;
  }
  return null;
};

describe("source text", () => {
  it("normalizes ligatures, controls, spaces and blank runs, and hashes the result", () => {
    const text = normalizeSource("ﬁrst​ line \r\n\r\n\r\n\r\n  second\t\tline  \u0007");
    expect(text).toBe("first line\n\nsecond line");
    expect(sourceHash(text)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("caps at a line break and spots a LinkedIn export", () => {
    expect(capChars("aaaa\nbbbb\ncccc", 11)).toBe("aaaa\nbbbb");
    expect(isLinkedInExport("Contact\nwww.linkedin.com/in/sample\nTop Skills\nSQL")).toBe(true);
    expect(isLinkedInExport("Top Skills\nSQL")).toBe(false);
  });

  it("offers contact details without storing them", () => {
    expect(contactIn("Sample Applicant\nsample@example.com | +1 415 555 0132 | github.com/sample\nEXPERIENCE")).toEqual({
      name: "Sample Applicant",
      email: "sample@example.com",
      phone: "+1 415 555 0132",
      location: null,
      links: ["github.com/sample"],
    });
  });
});

describe("magic bytes", () => {
  it("knows PDF and zip by their first bytes only", () => {
    expect(sniff(Buffer.from("%PDF-1.7\n"))).toBe("pdf");
    expect(sniff(Buffer.from("PK\x03\x04rest", "latin1"))).toBe("docx");
    expect(sniff(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBeNull(); // legacy .doc (OLE)
    expect(sniff(Buffer.from("{\\rtf1"))).toBeNull();
  });
});

describe("DOCX reader", () => {
  it("reads paragraphs, tabs, breaks and entities", () => {
    const xml = '<w:p><w:r><w:t>A &amp; B</w:t><w:tab/><w:t xml:space="preserve">C&#x2019;s</w:t><w:br/><w:t>D</w:t></w:r></w:p><w:p/>';
    expect(documentXmlToText(xml)).toBe("A & B\tC’s\nD\n\n");
    expect(decodeXmlText("&#0;&#xD800;&bogus;")).toBe("&#0;&#xD800;&bogus;");
    expect(docxText(docx(RESUME_LINES))).toBe(`${RESUME_LINES.join("\n")}\n`);
  });

  it("refuses macros, ActiveX, a macro content type and a non-Word zip", () => {
    expect(reasonOf(() => docxText(docx(RESUME_LINES, [{ name: "word/vbaProject.bin", data: "x" }])))).toBe("macro");
    expect(reasonOf(() => docxText(docx(RESUME_LINES, [{ name: "word/activeX/activeX1.xml", data: "<x/>" }])))).toBe("macro");
    expect(reasonOf(() => docxText(docx(RESUME_LINES, [], DOCX_TYPES.replace("document.main", "document.macroEnabled.main"))))).toBe("macro");
    expect(reasonOf(() => docxText(zip([{ name: "hello.txt", data: "hi" }])))).toBe("not_docx");
  });

  it("refuses a DTD or entity declaration (billion laughs, external entities)", () => {
    const laughs = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><w:document><w:p><w:t>&lol2;</w:t></w:p></w:document>`;
    const xxe = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><w:document><w:p><w:t>&e;</w:t></w:p></w:document>`;
    for (const xml of [laughs, xxe]) {
      expect(reasonOf(() => docxText(zip([{ name: "[Content_Types].xml", data: DOCX_TYPES }, { name: "word/document.xml", data: xml }])))).toBe("xml_dtd");
    }
  });

  it("refuses zip bombs: an honest ratio, a lying header, too many entries, too much in total", () => {
    const zeros = Buffer.alloc(20 * 1024 * 1024);
    expect(reasonOf(() => docxText(docx(RESUME_LINES, [{ name: "word/media/bomb.bin", data: zeros }])))).toBe("zip_ratio");
    // The header says 4 KB; zlib's output cap stops the inflate at maxPartBytes anyway.
    const lying = zip([{ name: "[Content_Types].xml", data: DOCX_TYPES }, { name: "word/document.xml", data: zeros, declaredSize: 4096 }]);
    expect(reasonOf(() => docxText(lying))).toBe("zip_ratio");
    const many = docx(RESUME_LINES, Array.from({ length: DOCX_LIMITS.maxEntries }, (_, i) => ({ name: `word/x${i}.xml`, data: "<x/>", stored: true })));
    expect(reasonOf(() => docxText(many))).toBe("zip_too_many_entries");
    const big = docx(RESUME_LINES, [{ name: "word/media/a.bin", data: randomBytes(16), declaredSize: DOCX_LIMITS.maxTotalBytes + 1, stored: true }]);
    expect(reasonOf(() => docxText(big))).not.toBeNull();
  });

  it("strips blocks in linear time: 2 MB of unterminated openers reads in well under a second (Security-reviewer-B)", () => {
    for (const opener of ["<mc:Fallback>", "<w:delText>"]) {
      const xml = `<w:document><w:body>${opener.repeat(150_000)}<w:p><w:r><w:t>Kept</w:t></w:r></w:p></w:body></w:document>`;
      const started = performance.now();
      expect(documentXmlToText(xml)).toBe("Kept\n");
      expect(performance.now() - started, opener).toBeLessThan(1000);
      const bomb = zip([{ name: "[Content_Types].xml", data: DOCX_TYPES }, { name: "word/document.xml", data: xml, stored: true }]);
      expect(docxText(bomb)).toBe("Kept\n");
    }
    expect(stripBlocks("a<x:b>1</x:b>c<x:bc>2</x:bc><x:b/>d", "x:b")).toBe("ac<x:bc>2</x:bc><x:b/>d");
  });

  it("never throws anything but FileRejected on 300 random mutations of a valid DOCX", () => {
    const good = docx(RESUME_LINES);
    for (let i = 0; i < 300; i++) {
      const bad = Buffer.from(good);
      for (let k = 0; k < 1 + (i % 8); k++) bad[Math.floor(Math.random() * bad.length)] = Math.floor(Math.random() * 256);
      try {
        expect(typeof docxText(bad)).toBe("string");
      } catch (err) {
        expect(err, `mutation ${i}`).toBeInstanceOf(FileRejected);
      }
    }
    // Truncations at every 37th byte.
    for (let n = 0; n < good.length; n += 37) expect(reasonOf(() => docxText(good.subarray(0, n)))).not.toBeNull();
  });
});

describe("PDF reader", () => {
  it("reads the text layer of a valid PDF", async () => {
    const { text, pages } = await pdfText(pdf(RESUME_LINES), 10);
    expect(pages).toBe(1);
    for (const line of RESUME_LINES) expect(text).toContain(line);
  });

  it("extracts text and nothing else from a PDF with a JavaScript action", async () => {
    const hostile = pdf(RESUME_LINES, ["<< /Type /Action /S /JavaScript /JS (app.alert\\(1\\)) >>"]);
    expect((await pdfText(hostile, 10)).text).toContain(RESUME_LINES[3]);
  });

  it("settles on 40 random mutations of a valid PDF", async () => {
    const good = pdf(RESUME_LINES);
    for (let i = 0; i < 40; i++) {
      const bad = Buffer.from(good);
      for (let k = 0; k < 1 + (i % 6); k++) bad[Math.floor(Math.random() * bad.length)] = Math.floor(Math.random() * 256);
      try {
        await pdfText(bad, 10);
      } catch (err) {
        expect(err, `mutation ${i}`).toBeInstanceOf(FileRejected);
      }
    }
  });
});

describe("extractFile: the thread and its limits", () => {
  it("reads a DOCX and a PDF in the capped thread", async () => {
    expect(await extractFile(docx(RESUME_LINES), OPTS)).toEqual({ text: RESUME_LINES.join("\n"), sourceKind: "docx" });
    const fromPdf = await extractFile(pdf(RESUME_LINES), OPTS);
    expect(fromPdf.sourceKind).toBe("pdf");
    expect(fromPdf.text).toContain("Built Tableau dashboards for 12 regional managers");
  });

  it("answers 413 over 5 MB, 415 for unknown types, macros and bombs, 422 for a scan and for garbage", async () => {
    expect(await rejection(Buffer.alloc(IMPORT_MAX_BYTES + 1))).toMatchObject({ status: 413, code: "payload_too_large" });
    expect(await rejection(Buffer.from("{\\rtf1 hello}"))).toMatchObject({ status: 415, code: "unsupported_type", reason: "magic_bytes" });
    expect(await rejection(docx(RESUME_LINES, [{ name: "word/vbaProject.bin", data: "x" }]))).toMatchObject({ status: 415, reason: "macro" });
    expect(await rejection(docx(RESUME_LINES, [{ name: "word/media/bomb.bin", data: Buffer.alloc(20 * 1024 * 1024) }]))).toMatchObject({ status: 415, reason: "zip_ratio" });
    expect(await rejection(pdf([]))).toMatchObject({ status: 422, code: "no_text_layer" });
    expect(await rejection(Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(4096)]))).toMatchObject({ status: 422 });
    expect(await rejection(Buffer.concat([Buffer.from("PK\x03\x04", "latin1"), randomBytes(4096)]))).toMatchObject({ status: 415 });
  });

  it("kills a thread that runs past its time limit", async () => {
    expect(await runThread({ kind: "pdf", bytes: pdf(RESUME_LINES), maxPages: 10, maxChars: 1000 }, 1)).toEqual({ ok: false, reason: "timeout" });
  });

  it("never sends back more than its character budget, however large the text layer (Security-reviewer-B)", async () => {
    const line = "Automated the weekly carrier scorecard in Python, saving 6 hours a week";
    for (const [kind, bytes] of [["pdf", pdf(Array.from({ length: 60 }, () => line))], ["docx", zip([{ name: "[Content_Types].xml", data: DOCX_TYPES }, { name: "word/document.xml", data: documentXml(Array.from({ length: 5000 }, () => line)), stored: true }])]] as const) {
      const reply = await runThread({ kind, bytes, maxPages: 10, maxChars: 500 });
      expect(reply.ok, kind).toBe(true);
      if (reply.ok) expect(reply.text.length, kind).toBeLessThanOrEqual(500);
    }
  });

  it("spot-checks the api's heap after the corpus: the process is still here and answering", async () => {
    const r = await extractFile(docx(["Still standing after the corpus", ...RESUME_LINES]), OPTS);
    expect(r.text.startsWith("Still standing")).toBe(true);
  });
});

void documentXml;
