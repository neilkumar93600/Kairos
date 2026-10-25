import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

// Embeds prompt files as text (the esbuild side is the ".md": "text" loader in build.mjs), so
// agent specs import prompts/v<N>.md and the gateway sends them byte for byte.
const markdownText: Plugin = {
  name: "markdown-text",
  transform(_code, id) {
    if (id.endsWith(".md")) {
      const text = readFileSync(id.split("?")[0]!, "utf8");
      return `export default ${JSON.stringify(text)};`;
    }
  },
};

export default defineConfig({
  plugins: [markdownText],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup-env.ts"],
  },
});
