import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,mjs}", "tests/**/*.test.{ts,mjs}", "scripts/**/*.test.{ts,mjs}"],
    allowOnly: false,
    retry: 0,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "scripts/*.{ts,mjs}"],
      exclude: ["**/*.test.{ts,mjs}"],
      reporter: ["text-summary", "html", "json", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
      reportOnFailure: true,
      thresholds: {
        "src/game/**/*.ts": { lines: 97, statements: 95, functions: 100, branches: 93 },
      },
    },
  },
});
