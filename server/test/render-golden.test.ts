import { spawnSync } from "node:child_process";
import { getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { compileTypst, RENDER_LIMITS, renderResumePdf, TYPST_VERSION, typstData } from "../src/services/render";
import { pdfText } from "../src/services/import/pdf";
import { resumePlainText } from "../src/services/resume-doc";
import { GOLDENS, INJECTION_LINES } from "./helpers/golden-resumes";

/**
 * The real binary (S-T1, CISO mustFix 8). Skipped when Typst is missing; CI installs the pinned release and sets REQUIRE_TYPST,
 * so there a missing binary fails instead. On Linux all of this runs under the real prlimit; elsewhere it has no memory cap.
 */
const bin = process.env.TYPST_BIN ?? "typst";
const version = spawnSync(bin, ["--version"], { encoding: "utf8" });
const hasTypst = version.status === 0;
if (process.env.REQUIRE_TYPST && !hasTypst) throw new Error("REQUIRE_TYPST is set but no Typst binary was found");

const squeeze = (s: string) => s.normalize("NFKC").replace(/[\s\p{Cf}]/gu, "");

describe.skipIf(!hasTypst)("the renderer with the real Typst", () => {
  it("is the pinned version", () => {
    expect(version.stdout).toContain(`typst ${TYPST_VERSION} `);
  });

  it("has 20 goldens, and one is the injection fixture", () => {
    expect(GOLDENS).toHaveLength(20);
    expect(GOLDENS.map((g) => g.name)).toContain("markup injection");
  });

  describe.each(["a4", "letter"] as const)("%s", (paper) => {
    it.each(GOLDENS.map((g) => [g.name, g] as const))("%s: the text layer is exactly the plain text, in order, on the recorded page count", async (_name, golden) => {
      const doc = { ...golden.doc, pageSize: paper };
      const pdf = await renderResumePdf(doc);
      const { text, pages } = await pdfText(pdf, 50);
      // Bullets are the template's own marks; nothing else may be added or lost.
      expect(squeeze(text).replaceAll("•", "")).toBe(squeeze(resumePlainText(doc)));
      expect(pages).toBe(golden.pages[paper]);
    });
  });

  // V1, observed with this binary: a glyph the embedded fonts lack comes out of the text layer as U+0000, so the round trip
  // fails. Chinese, Japanese, Korean, Devanagari and emoji all do; dingbats such as ✓ and ★ print.
  it.each([
    ["Chinese", "王小明", true],
    ["Japanese", "田中太郎", true],
    ["Korean", "김민준", true],
    ["emoji", "Ada 🚀 Lovelace", true],
    // Shaped, and the layer comes back garbled (U+0003, U+0005) rather than as U+0000: still a mismatch.
    ["Devanagari", "अनीता", false],
  ])("%s the fonts cannot print fails the round trip instead of shipping blank boxes", async (_script, name, nul) => {
    const doc = { ...GOLDENS[0]!.doc, contact: { ...GOLDENS[0]!.doc.contact, name } };
    const { text } = await pdfText(await compileTypst(typstData(doc)), 5);
    if (nul) expect(text).toContain("\u0000");
    await expect(renderResumePdf(doc)).rejects.toMatchObject({ code: "render_mismatch" });
  });

  it("symbols the fonts do have print and pass", async () => {
    await expect(renderResumePdf({ ...GOLDENS[0]!.doc, contact: { ...GOLDENS[0]!.doc.contact, name: "Ada ✓ ★ Lovelace" } })).resolves.toBeInstanceOf(Buffer);
  });

  it("prints on the paper the document asks for", async () => {
    const width = async (pageSize: "a4" | "letter") => {
      const doc = await getDocumentProxy(new Uint8Array(await renderResumePdf({ ...GOLDENS[0]!.doc, pageSize })), { verbosity: 0 });
      return Math.round((await doc.getPage(1)).getViewport({ scale: 1 }).width);
    };
    expect(await width("a4")).toBe(595);
    expect(await width("letter")).toBe(612);
  });

  it("the same document gives the same bytes: no clock in the file, so the content hash holds", async () => {
    const a = await renderResumePdf(GOLDENS[0]!.doc);
    expect((await renderResumePdf(GOLDENS[0]!.doc)).equals(a)).toBe(true);
  });

  it("markup in user text prints as text: nothing is read, imported, styled or evaluated", async () => {
    const golden = GOLDENS.find((g) => g.name === "markup injection")!;
    const { text, pages } = await pdfText(await renderResumePdf(golden.doc), 10);
    const flat = squeeze(text);
    for (const line of [...INJECTION_LINES, golden.doc.contact.name, "#set text(red)", '#import "x.typ"', "#panic()"]) expect(flat).toContain(squeeze(line));
    expect(pages).toBe(1); // #set page(paper: "a0") and size: 200pt did nothing
    expect(text).not.toMatch(/root:.*:0:0/);
  });

  it("a template cannot read outside its root, relative or absolute", async () => {
    const secretFile = process.platform === "win32" ? "C:/Windows/win.ini" : "/etc/passwd";
    for (const path of ["../../../../../../../../" + secretFile.replace(/^C:\//, ""), secretFile]) {
      await expect(compileTypst("{}", { template: `#read("${path}")` })).rejects.toMatchObject({ code: "render_exit" });
    }
  });

  it("a package import fails: the empty package paths hold nothing and no network was asked for by the template", async () => {
    await expect(compileTypst("{}", { template: '#import "@local/x:1.0.0": *' })).rejects.toMatchObject({ code: "render_exit" });
  });

  it.runIf(process.platform === "linux")("real Typst is held under the 256 MB cap: a template that needs more is killed, not served", async () => {
    // A string of 512 MB in memory, far past the address-space limit.
    const hog = '#let s = "x"\n#for _ in range(29) { s = s + s }\n#s.len()';
    await expect(compileTypst("{}", { template: hog })).rejects.toMatchObject({ code: expect.stringMatching(/render_exit|render_timeout/) });
  });

  it("a real run stays well under the limits it is held to", async () => {
    const big = GOLDENS.find((g) => g.name === "many pages")!;
    const started = Date.now();
    const pdf = await renderResumePdf(big.doc);
    expect(Date.now() - started).toBeLessThan(RENDER_LIMITS.killMs);
    expect(pdf.length).toBeLessThan(RENDER_LIMITS.maxPdfBytes / 5);
  });
});
