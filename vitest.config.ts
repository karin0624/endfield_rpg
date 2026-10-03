import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,mjs}", "tests/**/*.test.{ts,mjs}", "scripts/**/*.test.{ts,mjs}"],
    allowOnly: false,
  },
});
