import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Debugging/review recordings are not specification coverage and never create skipped CI tests.
export default defineConfig(config, {
  testDir: "./tests/evidence",
  projects: [{ name: "evidence", testMatch: "**/*.spec.ts", use: { baseURL: "http://127.0.0.1:4174" } }],
  webServer: [
    {
      command: "node scripts/serve-settings-test.mjs",
      wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4174\// },
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
  ],
});
