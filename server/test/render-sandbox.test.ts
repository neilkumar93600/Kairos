import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import classic from "../templates/classic.typ";
import { formAdapters } from "../../extension/src/ats";
import { fetchPdf, RESUME_INPUTS } from "../src/jobs/cloud-apply";
import { compileTypst, exportFilename, RENDER_LIMITS, RenderError, renderHash, textLayerHasLines, TYPST_VERSION, typstData } from "../src/services/render";
import { resumePlainText } from "../src/services/resume-doc";
import { GOLDENS } from "./helpers/golden-resumes";

/**
 * The sandbox around the child, tested with Node standing in for Typst, so it runs anywhere and needs no binary. The memory
 * cap would stop Node starting, so it is lifted here; render-golden.test.ts runs real Typst under the real cap.
 */
const dir = mkdtempSync(join(tmpdir(), "kairos-render-test-"));
const standIn = (name: string, source: string) => {
  const file = join(dir, `${name}.cjs`);
  writeFileSync(file, source);
  return { command: [process.execPath, file], memoryBytes: 2 ** 42 };
};
const dump = standIn("dump", `process.stdout.write("%PDF-" + JSON.stringify({ env: process.env, argv: process.argv.slice(2), cwd: process.cwd() }));`);
const report = async (data = "{}") => {
  const out = await compileTypst(data, dump);
  return JSON.parse(out.subarray(5).toString()) as { env: Record<string, string>; argv: string[]; cwd: string };
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("the child process", () => {
  const SECRETS = { DATABASE_URL: "postgres://secret-marker", STRIPE_SECRET_KEY: "secret-marker", R2_SNAPSHOTS_SECRET_ACCESS_KEY: "secret-marker" };
  afterAll(() => {
    for (const k of Object.keys(SECRETS)) delete process.env[k];
  });

  it("gets none of this process's secrets: the child's whole environment is read back", async () => {
    Object.assign(process.env, SECRETS);
    const { env } = await report();
    expect(JSON.stringify(env)).not.toContain("secret-marker");
    expect(Object.keys(env).filter((k) => /secret|key|token|password|database|redis|r2_/i.test(k))).toEqual([]);
    // Windows' process start adds its own required variables, none of ours; Linux is exact.
    if (process.platform === "linux") expect(Object.keys(env)).toEqual(["PATH"]);
  });

  it("takes user text as one sys.inputs argument and the template from a fixed name in a fresh root", async () => {
    const data = JSON.stringify({ name: 'x"; rm -rf / #read("/etc/passwd")' });
    const { argv, cwd } = await report(data);
    expect(argv[argv.indexOf("--input") + 1]).toBe(`data=${data}`);
    const root = argv[argv.indexOf("--root") + 1]!;
    expect(root).toContain("kairos-render-");
    expect(cwd).toBe(root);
    expect(argv.at(-2)).toBe(join(root, "main.typ"));
    expect(argv.at(-1)).toBe("-");
    expect(argv).toContain("--ignore-system-fonts");
    expect(argv[argv.indexOf("--package-path") + 1]).toBe(root);
    expect(argv[argv.indexOf("--package-cache-path") + 1]).toBe(root);
  });

  it("removes the root after a success and after each failure", async () => {
    const { argv } = await report();
    expect(existsSync(argv[argv.indexOf("--root") + 1]!)).toBe(false);
    const rootFile = join(dir, "root-of-failure");
    const failing = standIn("fail", `require("fs").writeFileSync(${JSON.stringify(rootFile)}, process.cwd()); process.exit(3);`);
    await expect(compileTypst("{}", failing)).rejects.toMatchObject({ code: "render_exit" });
    expect(existsSync(readFileSync(rootFile, "utf8"))).toBe(false);
  });

  it("a failure says a code and nothing Typst wrote, which can quote the document", async () => {
    const noisy = standIn("noisy", `console.error("error: unknown variable: Ada Lovelace +1 555 0100"); process.exit(1);`);
    const err = (await compileTypst("{}", noisy).catch((e: unknown) => e)) as RenderError;
    expect(err).toBeInstanceOf(RenderError);
    expect(err.message).toBe("render_exit");
    expect(JSON.stringify({ ...err, m: err.message, s: err.stack })).not.toContain("Lovelace");
  });

  it("kills a run past the limit, and on Linux everything it started: no orphan", async () => {
    const pids = join(dir, "pids");
    const hang = standIn(
      "hang",
      `const { spawn } = require("child_process");
       const kid = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "inherit" });
       require("fs").writeFileSync(${JSON.stringify(pids)}, JSON.stringify([process.pid, kid.pid]));
       setInterval(() => {}, 1000);`,
    );
    const started = Date.now();
    await expect(compileTypst("{}", { ...hang, killMs: 1_500 })).rejects.toMatchObject({ code: "render_timeout" });
    expect(Date.now() - started).toBeLessThan(10_000);
    const [child, grandchild] = JSON.parse(readFileSync(pids, "utf8")) as [number, number];
    expect(alive(child)).toBe(false);
    if (process.platform === "linux") expect(alive(grandchild)).toBe(false);
    else if (alive(grandchild)) process.kill(grandchild); // ponytail: no process group on a Windows dev machine; production is Linux
  });

  it("refuses output over the cap and kills the writer", async () => {
    const flood = standIn("flood", `const b = Buffer.alloc(1 << 20, 120); const w = () => process.stdout.write(b, w); w();`);
    await expect(compileTypst("{}", { ...flood, maxPdfBytes: 3 * (1 << 20), killMs: 8_000 })).rejects.toMatchObject({ code: "render_output_too_large" });
  });

  it("refuses output that is not a PDF, and input past what one argument can hold, before any spawn", async () => {
    await expect(compileTypst("{}", standIn("text", `process.stdout.write("hello");`))).rejects.toMatchObject({ code: "render_not_pdf" });
    await expect(compileTypst("x".repeat(RENDER_LIMITS.maxInputBytes + 1), { command: ["does-not-exist"] })).rejects.toMatchObject({ code: "render_too_large" });
  });

  it("a binary that is not there is a coded failure", async () => {
    await expect(compileTypst("{}", { command: [join(dir, "no-such-binary")], memoryBytes: 2 ** 42 })).rejects.toBeInstanceOf(RenderError);
  });
});

describe("the template and what it is given", () => {
  it("has no way in for anything but sys.inputs: no import, include, read, image, plugin, eval or text-matching show rule", () => {
    const code = classic.replace(/^\/\/.*$/gm, "");
    expect(code).toContain("json(bytes(sys.inputs.data))");
    expect(code).not.toMatch(/#?\b(import|include|read|image|plugin|eval)\b\s*[("@]/);
    expect(code).not.toMatch(/\bshow\b/);
  });

  it("the data holds what prints and no ids", () => {
    const data = typstData(GOLDENS[0]!.doc);
    expect(data).not.toMatch(/factIds|headingFactId|"id"/);
    expect(JSON.parse(data)).toMatchObject({ name: "Avery Stone", density: "comfortable", paper: "letter", accent: null });
  });

  it("the hash changes with what prints and not with what does not", () => {
    const doc = GOLDENS[0]!.doc;
    expect(renderHash(doc)).toMatch(/^[0-9a-f]{64}$/);
    expect(renderHash({ ...doc, name: "A library name" })).toBe(renderHash(doc));
    expect(renderHash({ ...doc, pageSize: "a4" })).not.toBe(renderHash(doc));
    expect(renderHash({ ...doc, contact: { ...doc.contact, name: "Someone Else" } })).not.toBe(renderHash(doc));
  });
});

describe("resumePlainText and the round trip", () => {
  const doc = GOLDENS.find((g) => g.name === "hidden parts do not print")!.doc;

  it("reads name, contact, then visible sections in print order, and skips hidden and empty parts", () => {
    const text = resumePlainText(doc);
    expect(text.split("\n").slice(0, 4)).toEqual(["Finley Hart", "finley@example.test | +1 555 0100 | Springfield | example.test/portfolio", "Experience", "Analyst | Fabrikam | 2018 to 2020"]);
    expect(text).not.toMatch(/Hidden|Nothing here|Empty/);
  });

  it("passes with wrapped lines and bullets, and fails on a lost line or a swapped order", () => {
    const plain = "Line one\nLine two is long";
    expect(textLayerHasLines("• Line\none\n• Line two\nis  long\n", plain)).toBe(true);
    expect(textLayerHasLines("Line one\n", plain)).toBe(false);
    expect(textLayerHasLines("Line two is long\nLine one", plain)).toBe(false);
  });

  it("does not count one line of the layer twice for a repeated line", () => {
    expect(textLayerHasLines("Same line", "Same line\nSame line")).toBe(false);
  });
});

describe("exportFilename", () => {
  it("is safe ASCII whatever the user typed", () => {
    expect(exportFilename("Ada Lovelace", "pdf", "Staff Engineer")).toBe("Ada Lovelace - Staff Engineer - Resume.pdf");
    expect(exportFilename("Renée Müller", "txt")).toBe("Renee Muller - Resume.txt");
    expect(exportFilename('x"\r\nSet-Cookie: a=b; filename="../../etc/passwd', "pdf")).toMatch(/^[A-Za-z0-9 ._-]+$/);
    expect(exportFilename("Анна", "pdf", "..")).toBe("Resume.pdf");
    expect(exportFilename("", "pdf", null)).toBe("Resume.pdf");
    expect(exportFilename("a".repeat(500), "pdf", "b".repeat(500)).length).toBeLessThan(140);
  });
});

describe("the pins", () => {
  const repo = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const DIGEST = "a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c";

  it("the worker image and CI install the same release, by the same SHA-256", () => {
    for (const file of ["server/Dockerfile", ".github/workflows/ci.yml"]) {
      const text = repo(file);
      expect(text).toContain(DIGEST);
      expect(text).toContain(`releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz`);
      expect(text).toContain("prlimit --version");
    }
  });

  it("the applier image holds no Typst: it attaches, the worker renders", () => {
    expect(repo("server/Dockerfile.applier")).not.toMatch(/typst/i);
  });

  it("the applier's resume inputs are the filler's", () => {
    expect(Object.fromEntries(formAdapters.map((a) => [a.provider, a.resumeInputSelector]))).toEqual(RESUME_INPUTS);
  });
});

describe("fetchPdf", () => {
  const answer = (body: BodyInit, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch;

  it("returns a PDF and refuses anything else", async () => {
    expect((await fetchPdf("https://r2.test/x", answer("%PDF-1.7 body"))).toString()).toBe("%PDF-1.7 body");
    await expect(fetchPdf("https://r2.test/x", answer("<html>"))).rejects.toThrow("pdf_not_pdf");
    await expect(fetchPdf("https://r2.test/x", answer("%PDF-", 403))).rejects.toThrow("pdf_fetch_failed");
    await expect(fetchPdf("https://r2.test/x", answer(Buffer.alloc(5 * 1024 * 1024 + 1)))).rejects.toThrow("pdf_too_large");
  });

  it("follows no redirect", async () => {
    let init: RequestInit | undefined;
    await fetchPdf("https://r2.test/x", (async (_u: string, i: RequestInit) => ((init = i), new Response("%PDF-"))) as never);
    expect(init?.redirect).toBe("error");
  });
});
