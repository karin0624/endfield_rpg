import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (!existsSync("/.dockerenv")) {
  throw new Error("Playwright tests require the Docker container. Run npm run test:e2e or npm run test:editor.");
}

const coverage = process.env.COVERAGE_BROWSER === "1";
const editor = process.env.PLAYWRIGHT_EDITOR === "1";
const uiOnly = process.env.PLAYWRIGHT_UI === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: coverage ? "test-results/coverage" : "test-results/browser",
  globalSetup: coverage ? "./scripts/browser-coverage-setup.mjs" : undefined,
  globalTeardown: coverage ? "./scripts/browser-coverage-teardown.mjs" : undefined,
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: 0,
  updateSnapshots: "none",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: coverage ? "playwright-report/coverage" : "playwright-report" }],
    ["json", { outputFile: coverage ? "test-results/playwright-coverage.json" : "test-results/playwright.json" }],
  ],
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "built", testDir: "./tests/e2e/built", testMatch: "**/*.spec.ts" },
    {
      name: "debug",
      testDir: "./tests/e2e/debug",
      testMatch: "**/*.spec.ts",
      snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-built-{platform}{ext}",
      use: { baseURL: "http://127.0.0.1:4175" },
    },
    {
      name: "ui",
      testDir: "./tests/e2e/ui",
      testMatch: "**/*.spec.ts",
      use: { baseURL: "http://127.0.0.1:4174" },
    },
    {
      name: "settings",
      testDir: "./tests/e2e/settings",
      testMatch: "**/*.spec.ts",
      use: { baseURL: "http://127.0.0.1:4174" },
    },
  ],
  webServer:
    editor || uiOnly
      ? [
          {
            command: "node scripts/serve-settings-test.mjs",
            wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4174\// },
            gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
          },
        ]
      : [
          {
            command: `npx vite preview --outDir ${coverage ? "dist-debug-coverage" : "dist-debug"} --host 127.0.0.1 --port 4175 --strictPort`,
            wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4175\// },
          },
          {
            command: `npx vite preview --outDir ${coverage ? "dist-coverage" : "dist"} --host 127.0.0.1 --port 4173 --strictPort`,
            wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4173\// },
          },
          {
            command: "node scripts/serve-settings-test.mjs",
            wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4174\// },
            gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
          },
        ],
});
