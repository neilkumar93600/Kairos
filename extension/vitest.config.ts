import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __API_BASE__: JSON.stringify("http://localhost:3000") },
  test: { environment: "jsdom", include: ["test/**/*.test.ts"] },
});
