import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENTS } from "../../src/agents/registry";
import { toStrictJsonSchema } from "../../src/llm/schema";

const here = join(import.meta.dirname ?? ".");

describe("toStrictJsonSchema per agent", () => {
  for (const [id, spec] of Object.entries(AGENTS)) {
    it(`${id}: the committed snapshot equals a fresh build`, () => {
      const snapPath = join(here, "..", "..", "src", "agents", id, "schema.snap.json");
      const committed = JSON.parse(readFileSync(snapPath, "utf8")) as Record<string, unknown>;
      expect(committed).toEqual(toStrictJsonSchema(spec.output));
    });

    it(`${id}: sends only the supported subset (2.4)`, () => {
      const raw = JSON.stringify(spec.schemaSnapshot);
      for (const banned of ['"minLength"', '"maxLength"', '"minimum"', '"maximum"', '"multipleOf"', '"maxItems"', '"allOf"', '"oneOf"', '"$schema"']) {
        expect(raw, `${id} must not send ${banned}`).not.toContain(banned);
      }
    });

    it(`${id}: closes every object and requires every property`, () => {
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        const n = node as Record<string, unknown>;
        if (n.type === "object" && n.properties) {
          expect(n.additionalProperties, `${id} object must be closed`).toBe(false);
          const props = n.properties as Record<string, unknown>;
          const required = (n.required as string[]) ?? [];
          for (const name of Object.keys(props)) expect(required, `${id}.${name} must be required`).toContain(name);
        }
        for (const value of Object.values(n)) if (value && typeof value === "object") walk(value);
      };
      walk(spec.schemaSnapshot);
    });
  }

  it("keeps enums constrained in the sent schema (unlike the SDK helper)", () => {
    const parser = JSON.stringify(AGENTS["resume-parser"].schemaSnapshot);
    expect(parser).toContain('"enum"');
  });

  it("keeps personal data out of the schemas", () => {
    const all = JSON.stringify(Object.values(AGENTS).map((a) => a.schemaSnapshot));
    expect(all).not.toMatch(/@/); // no emails
    expect(all).not.toMatch(/https?:\/\//); // no URLs
  });
});
