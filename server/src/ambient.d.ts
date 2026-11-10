// Prompt files are embedded as text (esbuild loader ".md": "text" in build.mjs; the equivalent
// plugin in vitest.config.ts). The gateway sends them byte for byte as the static system block.
declare module "*.md" {
  const text: string;
  export default text;
}

// Typst templates, embedded the same way (build.mjs, vitest.config.ts).
declare module "*.typ" {
  const text: string;
  export default text;
}
