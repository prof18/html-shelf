import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: new URL("./tests/mocks/obsidian.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // The plugin entry point is lifecycle glue covered by manual verification.
      exclude: ["src/main.ts"],
      thresholds: {
        lines: 80,
        "src/core/**": {
          lines: 95,
          branches: 95,
        },
      },
    },
  },
});
