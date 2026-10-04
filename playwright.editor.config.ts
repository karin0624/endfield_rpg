import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Developer-only detail checks run when changing editors, standard settings or HMR.
export default defineConfig({
  ...config,
  testDir: "./tests/editor",
  outputDir: "test-results/editor",
  globalSetup: undefined,
  globalTeardown: undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/editor" }],
    ["json", { outputFile: "test-results/playwright-editor.json" }],
  ],
  projects: [
    {
      name: "settings",
      testMatch: "**/*.spec.ts",
      // Keep the existing image bytes and names at their original paths.
      snapshotPathTemplate: "{testDir}/../e2e/settings/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}",
      use: { baseURL: "http://127.0.0.1:4174" },
    },
  ],
  webServer: [
    {
      command: "node scripts/serve-settings-test.mjs",
      wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4174\// },
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
  ],
});
