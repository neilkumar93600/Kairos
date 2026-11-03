import { inflateRawSync } from "node:zlib";

/**
 * DOCX to text with no dependency (CISO mustFix 8): a zip read from its central directory, every limit checked before a
 * byte is inflated, and the two XML parts read as text by pattern, never by an XML parser, so DTDs and external
 * entities have nothing to expand. Hostile input throws FileRejected; the caller maps it to 415 or 422.
 * ponytail: paragraphs, tabs and breaks only; numbering, headers and footers are dropped (the parser needs the words).
 */

export class FileRejected extends Error {
  constructor(readonly reason: string) {
    super(`file rejected: ${reason}`);
    this.name = "FileRejected";
  }
}

export const DOCX_LIMITS = {
  /** A resume DOCX holds 10 to 40 parts. */
  maxEntries: 300,
  /** Declared uncompressed size of the whole archive. */
  maxTotalBytes: 50 * 1024 * 1024,
  /** Inflated size of one part we read; enforced by zlib, whatever the header declares. */
  maxPartBytes: 8 * 1024 * 1024,
  /** Declared uncompressed / compressed per entry: a zip bomb runs at 1,000 and up, real XML at 5 to 20. */
  maxRatio: 100,
} as const;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

const u16 = (b: Buffer, at: number) => b.readUInt16LE(at);
const u32 = (b: Buffer, at: number) => b.readUInt32LE(at);

/** The central directory, checked against DOCX_LIMITS. Zip64, encryption and multi-disk archives are refused. */
export function zipEntries(zip: Buffer): Entry[] {
  // The end-of-central-directory record sits in the last 22 + 65,535 (comment) bytes.
  const from = Math.max(0, zip.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = zip.length - 22; i >= from; i--) {
    if (u32(zip, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new FileRejected("not_a_zip");
  const count = u16(zip, eocd + 10);
  const cdSize = u32(zip, eocd + 12);
  const cdOffset = u32(zip, eocd + 16);
  if (u16(zip, eocd + 4) !== 0 || u16(zip, eocd + 6) !== 0) throw new FileRejected("zip_multi_disk");
  if (count === 0xffff || cdOffset === 0xffffffff) throw new FileRejected("zip64");
  if (count > DOCX_LIMITS.maxEntries) throw new FileRejected("zip_too_many_entries");
  if (cdOffset + cdSize > eocd) throw new FileRejected("zip_corrupt");

  const entries: Entry[] = [];
  let total = 0;
  for (let at = cdOffset, i = 0; i < count; i++) {
    if (at + 46 > eocd || u32(zip, at) !== 0x02014b50) throw new FileRejected("zip_corrupt");
    const flags = u16(zip, at + 8);
    const method = u16(zip, at + 10);
    const compressedSize = u32(zip, at + 20);
    const size = u32(zip, at + 24);
    const nameLen = u16(zip, at + 28);
    const next = at + 46 + nameLen + u16(zip, at + 30) + u16(zip, at + 32);
    if (next > eocd) throw new FileRejected("zip_corrupt");
    const name = zip.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    if (flags & 0x1) throw new FileRejected("zip_encrypted");
    if (method !== 0 && method !== 8) throw new FileRejected("zip_method");
    if (size === 0xffffffff || compressedSize === 0xffffffff) throw new FileRejected("zip64");
    if (size > DOCX_LIMITS.maxRatio * Math.max(compressedSize, 1) && size > 1024) throw new FileRejected("zip_ratio");
    total += size;
    if (total > DOCX_LIMITS.maxTotalBytes) throw new FileRejected("zip_too_large");
    entries.push({ name, method, compressedSize, size, localOffset: u32(zip, at + 42) });
    at = next;
  }
  return entries;
}

/** One part's bytes, inflated with zlib's own output cap, so a header that lies about its size still stops at the cap. */
function readEntry(zip: Buffer, e: Entry): Buffer {
  const at = e.localOffset;
  if (at + 30 > zip.length || u32(zip, at) !== 0x04034b50) throw new FileRejected("zip_corrupt");
  const start = at + 30 + u16(zip, at + 26) + u16(zip, at + 28);
  const data = zip.subarray(start, start + e.compressedSize);
  if (data.length !== e.compressedSize) throw new FileRejected("zip_corrupt");
  if (e.method === 0) {
    if (data.length > DOCX_LIMITS.maxPartBytes) throw new FileRejected("zip_too_large");
    return data;
  }
  try {
    return inflateRawSync(data, { maxOutputLength: DOCX_LIMITS.maxPartBytes });
  } catch (err) {
    throw new FileRejected((err as { code?: string }).code === "ERR_BUFFER_TOO_LARGE" ? "zip_ratio" : "zip_corrupt");
  }
}

const XML_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

/** The five predefined entities and numeric references; any other `&name;` stays as written. */
export function decodeXmlText(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|lt|gt|amp|quot|apos);/g, (all, ref: string) => {
    if (!ref.startsWith("#")) return XML_ENTITIES[ref]!;
    const cp = ref[1] === "x" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : all;
  });
}

/** XML read as text: a DOCTYPE or ENTITY declaration is refused (no DTDs, so no entity expansion of any kind). */
function xmlText(buf: Buffer): string {
  const text = buf.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new FileRejected("xml_dtd");
  return text;
}

/**
 * Removes every <name ...>...</name> block in one left-to-right pass with indexOf, so an opener with no closer costs
 * one scan, not one per opener (a lazy [\s\S]*? regex is quadratic there: 1.6 MB of unterminated openers took 18 s,
 * Security-reviewer-B). Same result as that regex: an unterminated opener and what follows it stay.
 */
export function stripBlocks(xml: string, name: string): string {
  const open = `<${name}`;
  const close = `</${name}>`;
  let out = "";
  let i = 0;
  for (;;) {
    const a = xml.indexOf(open, i);
    if (a < 0) return out + xml.slice(i);
    // A longer tag name that starts the same (<w:delTextX) is not this block.
    if (/[\w:.-]/.test(xml[a + open.length] ?? "")) {
      out += xml.slice(i, a + open.length);
      i = a + open.length;
      continue;
    }
    const b = xml.indexOf(close, a);
    if (b < 0) return out + xml.slice(i);
    out += xml.slice(i, a);
    i = b + close.length;
  }
}

/**
 * Paragraphs, tabs and breaks of word/document.xml as plain lines. Numeric references decode to any code point,
 * controls such as U+202E included: callers run the result through normalizeSource (services/import/source.ts).
 */
export function documentXmlToText(xml: string): string {
  // Text boxes appear twice (DrawingML and a VML fallback); keep the first. Deleted tracked changes are not text.
  const body = stripBlocks(stripBlocks(xml, "mc:Fallback"), "w:delText");
  let out = "";
  for (const m of body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>|<w:p\b[^>]*\/>/g)) {
    if (m[1] !== undefined) out += decodeXmlText(m[1]);
    else if (m[0] === "<w:tab/>") out += "\t";
    else out += "\n";
  }
  return out;
}

/**
 * Text of a DOCX. Refuses macro-enabled documents (a VBA project or a macro content type), ActiveX parts, anything
 * that is not a Word document, and every zip or XML limit above.
 */
export function docxText(zip: Buffer): string {
  const entries = zipEntries(zip);
  const byName = new Map(entries.map((e) => [e.name, e]));
  if (entries.some((e) => /(^|\/)vbaProject\.bin$|(^|\/)vbaData\.xml$|^word\/activeX\//i.test(e.name))) throw new FileRejected("macro");
  const types = byName.get("[Content_Types].xml");
  const doc = byName.get("word/document.xml");
  if (!types || !doc) throw new FileRejected("not_docx");
  const typesXml = xmlText(readEntry(zip, types));
  if (/macroEnabled|vbaProject/i.test(typesXml)) throw new FileRejected("macro");
  if (!typesXml.includes("wordprocessingml.document.main+xml")) throw new FileRejected("not_docx");
  return documentXmlToText(xmlText(readEntry(zip, doc)));
}
