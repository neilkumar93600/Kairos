import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Proves the boundary rules in eslint.config.mjs: the Anthropic SDK is imported only under src/llm/, and credit_ledger
// is written only by services/credits.ts. The rules are worthless if they silently stop matching, so each one is
// shown firing on a violation and staying quiet on the allowed place.
const CWD = fileURLToPath(new URL("..", import.meta.url));
const eslint = new ESLint({ cwd: CWD });

async function messages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath: `${CWD}${filePath}` });
  return result!.messages.map((m) => `${m.ruleId}: ${m.message}`);
}

describe("server ESLint boundary rules", () => {
  it("rejects the Anthropic SDK outside src/llm/", async () => {
    expect(await messages(`import Anthropic from "@anthropic-ai/sdk";\nexport const c = Anthropic;\n`, "src/routes/x.ts")).toEqual([
      expect.stringContaining("@anthropic-ai/sdk"),
    ]);
    expect(await messages(`import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";\nexport const z = zodOutputFormat;\n`, "src/services/x.ts")).toHaveLength(1);
  });

  it("allows the Anthropic SDK under src/llm/", async () => {
    expect(await messages(`import Anthropic from "@anthropic-ai/sdk";\nexport const c = Anthropic;\n`, "src/llm/client.ts")).toEqual([]);
  });

  it("rejects credit_ledger writes outside services/credits.ts, in every spelling", async () => {
    const insertQualified = `export const f = (tx) => tx.insert(schema.creditLedger).values({});\n`;
    const insertBare = `export const f = (tx) => tx.insert(creditLedger).values({});\n`;
    const update = `export const f = (tx) => tx.update(creditLedger).set({});\n`;
    const del = `export const f = (tx) => tx.delete(schema.creditLedger);\n`;
    const raw = "export const f = (tx) => tx.execute(sql`insert into credit_ledger (user_id) values (1)`);\n";
    for (const code of [insertQualified, insertBare, update, del, raw]) {
      expect(await messages(code, "src/routes/x.ts"), code).toEqual([expect.stringContaining("credit_ledger")]);
    }
  });

  it("allows reading credit_ledger anywhere, and writing it in services/credits.ts", async () => {
    expect(await messages(`export const f = (db) => db.select().from(creditLedger);\n`, "src/routes/x.ts")).toEqual([]);
    expect(await messages(`export const f = (tx) => tx.insert(creditLedger).values({});\n`, "src/services/credits.ts")).toEqual([]);
  });

  it("the whole of src/ passes", async () => {
    const results = await eslint.lintFiles(["src/**/*.ts"]);
    const errors = results.flatMap((r) => r.messages.map((m) => `${r.filePath}:${m.line} ${m.ruleId}: ${m.message}`));
    expect(errors).toEqual([]);
  });
});
