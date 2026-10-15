// Bundles each entry point into dist/. npm dependencies stay external (installed in the image);
// the @auto-career/shared workspace is bundled in because it ships TypeScript source.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@auto-career/"));

await build({
  entryPoints: ["src/api.ts", "src/worker.ts", "src/applier.ts", "src/migrate.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external,
  banner: {
    // Lets bundled CommonJS dependencies call require() inside the ESM output.
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
