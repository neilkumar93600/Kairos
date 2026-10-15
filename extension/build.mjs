// Builds the MV3 extension into dist/. API_BASE picks the Kairos origin the extension talks to.
//   node build.mjs            production build (https://kairos.app)
//   API_BASE=http://localhost:3000 node build.mjs --watch
import { context, build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const apiBase = process.env.API_BASE ?? "https://kairos.app";
const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const origin = new URL(apiBase).origin;
manifest.host_permissions = [...new Set([...manifest.host_permissions, `${origin}/*`])];
manifest.externally_connectable.matches = [...new Set([...manifest.externally_connectable.matches, `${origin}/*`])];
writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2));
cpSync("sidepanel.html", "dist/sidepanel.html");
// public/ holds static assets (icons for the store listing). Git drops empty folders, so it may be absent.
if (existsSync("public")) cpSync("public", "dist", { recursive: true });

const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    sidepanel: "src/sidepanel.ts",
    // Self-contained filler, also injected by the cloud applier (server/src/jobs/cloud-apply.ts).
    filler: "src/filler.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  define: { __API_BASE__: JSON.stringify(apiBase) },
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
