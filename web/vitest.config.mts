import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure landing modules only (web/test). Node environment: no DOM needed.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
