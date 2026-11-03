import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CATALOG } from "../src/lib/error-catalog";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith(".ts") ? [join(dir, f)] : []));
const sources = files("src").map((file) => [file, readFileSync(file, "utf8")] as const);


describe("error catalog", () => {
  it("lists every code and status that src/ passes to HttpError", () => {
    const unlisted: string[] = [];
    for (const [file, text] of sources) {
      for (const m of text.matchAll(/new HttpError\(\s*(\d{3}),\s*"([a-z_]+)"/g)) {
        if (!ERROR_CATALOG[m[2]!]?.includes(Number(m[1]))) unlisted.push(`${m[1]} ${m[2]} (${file})`);
      }
    }
    expect(unlisted).toEqual([]);
  });

  it("has no HttpError whose status and code are not literals (the check above could not see them)", () => {
    const hidden: string[] = [];
    for (const [file, text] of sources) {
      const all = [...text.matchAll(/new HttpError\(/g)].length;
      const literal = [...text.matchAll(/new HttpError\(\s*\d{3},\s*"[a-z_]+"/g)].length;
      if (all !== literal) hidden.push(file);
    }
    expect(hidden).toEqual([]);
  });

  it("lists no code that nothing emits", () => {
    const all = sources.map(([, t]) => t).join("\n");
    const dead = Object.keys(ERROR_CATALOG).filter((code) => !all.includes(`"${code}"`));
    expect(dead).toEqual([]);
  });

  it("is sorted and uses only snake_case codes with 4xx or 5xx statuses", () => {
    const codes = Object.keys(ERROR_CATALOG);
    expect(codes).toEqual([...codes].sort());
    for (const [code, statuses] of Object.entries(ERROR_CATALOG)) {
      expect(code).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(statuses.every((s) => s >= 400 && s < 600), code).toBe(true);
    }
  });
});
