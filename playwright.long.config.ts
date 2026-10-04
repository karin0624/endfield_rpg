import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// This complete campaign journey is explicitly requested, rather than run in default PR CI.
export default defineConfig({
  ...config,
  testDir: "./tests/long",
  outputDir: "test-results/long",
  globalSetup: undefined,
  globalTeardown: undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/long" }],
    ["json", { outputFile: "test-results/playwright-long.json" }],
  ],
  projects: [{ name: "built", testMatch: "**/*.spec.ts" }],
  webServer: [
    {
      command: "npx vite preview --outDir dist --host 127.0.0.1 --port 4173 --strictPort",
      wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4173\// },
    },
  ],
});
