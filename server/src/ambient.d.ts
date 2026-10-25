// Prompt files are embedded as text (esbuild loader ".md": "text" in build.mjs; the equivalent
// plugin in vitest.config.ts). The gateway sends them byte for byte as the static system block.
declare module "*.md" {
  const text: string;
  export default text;
}
