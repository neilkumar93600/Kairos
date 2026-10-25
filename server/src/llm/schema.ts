import { z } from "zod";

/**
 * Strict JSON schema generation (03-agent-runtime.md 2.4). Builds the schema sent to the API from
 * the agent's output zod schema: every object closed, every property required, unsupported bounds
 * moved into descriptions, enums preserved (unlike the SDK's zodOutputFormat helper, which drops
 * constrained decoding of enums in 1.1.0).
 */

/** The supported subset on the Anthropic API [V]. */
const UNSUPPORTED_KEYS = ["minLength", "maxLength", "minimum", "maximum", "multipleOf", "maxItems", "exclusiveMinimum", "exclusiveMaximum", "minProperties", "maxProperties", "allOf", "oneOf", "not", "if", "then", "else", "dependencies", "patternProperties"] as const;

/** Keywords zod emits that the API refuses outright; they are deleted, never described. */
const DELETE_KEYS = ["$schema", "$id", "$anchor", "$comment", "deprecated", "examples", "title"] as const;

export class StrictSchemaError extends Error {
  override name = "StrictSchemaError";
}

const describe = (node: Record<string, unknown>, sentence: string): void => {
  const base = typeof node.description === "string" ? `${node.description} ` : "";
  node.description = `${base}${sentence}`;
};

/** Normalizes enum casing in a decoded reply: a case-insensitive match maps onto the schema literal. */
export function normalizeEnumCase(json: unknown, schema: z.ZodType): unknown {
  const literals = enumLiterals(z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }));
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      const match = literals.find((l) => l.toLowerCase() === value.toLowerCase());
      return match ?? value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    }
    return value;
  };
  return walk(json);
}

function enumLiterals(schemaNode: unknown, acc: Set<string> = new Set()): string[] {
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.enum)) for (const v of n.enum) if (typeof v === "string") acc.add(v);
    for (const key of ["properties", "items", "additionalProperties", "$defs", "definitions"]) {
      const child = n[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) child.forEach(visit);
        else Object.values(child).forEach(visit);
      }
    }
    if (Array.isArray(n.anyOf)) n.anyOf.forEach(visit);
    if (Array.isArray(n.prefixItems)) n.prefixItems.forEach(visit);
  };
  visit(schemaNode);
  return [...acc];
}

/**
 * Builds the strict schema from a zod schema. Build-time failures (optional fields, recursion, more
 * than 12 anyOf nodes) throw here, so the registry test catches them, never a live call.
 */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }) as Record<string, unknown>;
  const state = { anyOf: 0, sawOptional: false };
  const strict = strictNode(raw, state, "$") as Record<string, unknown>;
  if (state.sawOptional) throw new StrictSchemaError("optional() fields are not allowed; use .nullable() (agents keep every property required)");
  if (state.anyOf > 12) throw new StrictSchemaError(`too many anyOf nodes: ${state.anyOf} (limit 12, headroom under the API's 16)`);
  return strict;
}

function strictNode(node: unknown, state: { anyOf: number; sawOptional: boolean }, path: string): unknown {
  if (Array.isArray(node)) return node.map((item) => strictNode(item, state, path));
  if (!node || typeof node !== "object") return node;
  const n = node as Record<string, unknown>;

  for (const key of DELETE_KEYS) delete n[key];

  if (Array.isArray(n.anyOf) || Array.isArray(n.oneOf)) {
    state.anyOf += 1;
    if (state.anyOf > 12) throw new StrictSchemaError(`too many anyOf nodes at ${path}`);
    if (n.oneOf) {
      n.anyOf = strictNode(n.oneOf, state, path) as unknown[];
      delete n.oneOf;
    }
  }

  for (const key of UNSUPPORTED_KEYS) {
    if (key in n) {
      describe(n, boundSentence(key, n[key]));
      delete n[key];
    }
  }

  if (n.type === "object" && typeof n.properties === "object" && n.properties !== null) {
    n.additionalProperties = false;
    const props = n.properties as Record<string, unknown>;
    const required = new Set((Array.isArray(n.required) ? n.required : []) as string[]);
    for (const [name, child] of Object.entries(props)) {
      const c = child as Record<string, unknown>;
      // zod renders optional properties by omitting them from required; restore it and record the fact.
      if (!required.has(name) && n.type === "object") {
        state.sawOptional = true;
      }
      required.add(name);
      props[name] = strictNode(child, state, `${path}.${name}`);
    }
    n.required = [...required];
  }

  if (n.items !== undefined) n.items = strictNode(n.items, state, `${path}[]`);
  if (n.prefixItems !== undefined) n.prefixItems = strictNode(n.prefixItems, state, `${path}[]`);
  if (n.$defs && typeof n.$defs === "object") {
    n.$defs = Object.fromEntries(Object.entries(n.$defs).map(([k, v]) => [k, strictNode(v, state, `${path}.${k}`)]));
  }
  if (n.additionalProperties && typeof n.additionalProperties === "object") {
    n.additionalProperties = strictNode(n.additionalProperties, state, `${path}.additionalProperties`);
  }

  // minItems 0 or 1 only [V]; clamped, the zod schema still enforces the real minimum.
  if (typeof n.minItems === "number" && n.minItems > 1) {
    describe(n, `At least ${n.minItems} items.`);
    n.minItems = 1;
  }
  return n;
}

function boundSentence(key: string, value: unknown): string {
  switch (key) {
    case "minLength":
      return `At least ${value} characters.`;
    case "maxLength":
      return `At most ${value} characters.`;
    case "minimum":
      return `At least ${value}.`;
    case "maximum":
      return `At most ${value}.`;
    case "exclusiveMinimum":
      return `Greater than ${value}.`;
    case "exclusiveMaximum":
      return `Less than ${value}.`;
    case "multipleOf":
      return `A multiple of ${value}.`;
    case "maxItems":
      return `At most ${value} items.`;
    case "minProperties":
      return `At least ${value} properties.`;
    case "maxProperties":
      return `At most ${value} properties.`;
    case "patternProperties":
      return `Property names follow a pattern the server validates.`;
    default:
      return `Constrained on the server: ${key}=${JSON.stringify(value)}.`;
  }
}

/** Canonical JSON: object keys sorted, so sha256 over it is stable (7.3). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}
