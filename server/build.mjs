// Bundles each entry point into dist/. npm dependencies stay external (installed in the image);
// the @auto-career/shared workspace is bundled in because it ships TypeScript source.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@auto-career/"));

await build({
  // pgbackup.ts runs in its own image (ops/pgbackup/Dockerfile), the Railway cron service of WP-13.
  // workers/extract-thread.ts is the api's file-extraction thread; services/import/extract.ts loads dist/workers/extract-thread.js.
  entryPoints: ["src/api.ts", "src/worker.ts", "src/applier.ts", "src/migrate.ts", "src/pgbackup.ts", "src/workers/extract-thread.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external,
  loader: {
    // Prompt files are bundled as text so the running service holds every retained version
    // (03-agent-runtime.md 4.4); the vitest side is the markdown-text plugin in vitest.config.ts.
    ".md": "text",
    // Typst templates likewise: the worker holds the template, and no path to one ever reaches the renderer.
    ".typ": "text",
  },
  banner: {
    // Lets bundled CommonJS dependencies call require() inside the ESM output.
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
