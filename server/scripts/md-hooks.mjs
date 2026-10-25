import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Node module hook for the agents:snap and agents:lock scripts: loads prompt files as their text,
 * the same content the ".md": "text" esbuild loader bundles and the vitest markdown-text plugin
 * serves. Run via `node --import tsx --import ./scripts/md-register.mjs <script>`.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith(".md")) {
    const text = readFileSync(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${JSON.stringify(text)};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
