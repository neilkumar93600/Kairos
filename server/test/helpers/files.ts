import { crc32, deflateRawSync } from "node:zlib";

/**
 * Builders for the untrusted-file corpus (test/import-gate.test.ts): a zip writer that can lie about sizes, a DOCX on
 * top of it, and a one-page text PDF. Synthetic content only.
 */

export interface ZipPart {
  name: string;
  data: Buffer | string;
  /** Store instead of deflate. */
  stored?: boolean;
  /** Override the declared uncompressed size in both headers (a lying zip bomb). */
  declaredSize?: number;
}

export function zip(parts: ZipPart[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const p of parts) {
    const raw = Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data, "utf8");
    const body = p.stored ? raw : deflateRawSync(raw);
    const name = Buffer.from(p.name, "utf8");
    const size = p.declaredSize ?? raw.length;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(p.stored ? 0 : 8, 8);
    head.writeUInt32LE(crc32(raw), 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(size, 22);
    head.writeUInt16LE(name.length, 26);
    locals.push(head, name, body);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(p.stored ? 0 : 8, 10);
    cd.writeUInt32LE(crc32(raw), 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += 30 + name.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, end]);
}

export const DOCX_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const documentXml = (paragraphs: string[]) =>
  '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`).join("") +
  "</w:body></w:document>";

export function docx(paragraphs: string[], extra: ZipPart[] = [], types = DOCX_TYPES): Buffer {
  return zip([{ name: "[Content_Types].xml", data: types }, { name: "word/document.xml", data: documentXml(paragraphs) }, ...extra]);
}

/** A valid one-page PDF whose page shows `lines` in Helvetica, with a correct xref table. */
export function pdf(lines: string[], extraObjects: string[] = []): Buffer {
  const content = `BT /F1 11 Tf 14 TL 72 760 Td ${lines.map((l) => `(${l.replace(/[\\()]/g, (c) => `\\${c}`)}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...extraObjects,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** A synthetic resume, long enough to pass the 100-character text-layer floor. */
export const RESUME_LINES = [
  "Sample Applicant",
  "EXPERIENCE",
  "Data Analyst, Sample Analytics Co | Columbus, OH | Feb 2022 - Present",
  "Automated the weekly carrier scorecard in Python, saving 6 hours a week",
  "Built Tableau dashboards for 12 regional managers",
  "EDUCATION",
  "M.S. Business Analytics, Sample State University, 2021",
];
