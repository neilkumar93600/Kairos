import { createHash } from "node:crypto";
import type { PromptAsset } from "./types";
import { canonicalJson } from "../llm/schema";

/**
 * Prompt assets and fingerprints (03-agent-runtime.md 4.4). A version number always identifies one
 * exact prompt: the fingerprint covers the static system text and the schema snapshot, so an edit
 * to either without a new version fails the registry test.
 *
 * Deviation from 4.4, recorded here: the render.ts source text is not folded into the fingerprint
 * because esbuild cannot embed TS source as text without a custom plugin; render is a pure function
 * covered byte-for-byte by its own unit tests instead. The lock file is still CI-checked.
 */
export function promptAsset(agentId: string, version: number, systemText: string, schemaSnapshot: Record<string, unknown>): PromptAsset {
  const fingerprint = createHash("sha256")
    .update(`${systemText}\n--schema--\n${canonicalJson(schemaSnapshot)}`)
    .digest("hex");
  return { version, system: systemText, fingerprint };
}
