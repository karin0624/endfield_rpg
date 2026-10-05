import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (!existsSync("/.dockerenv")) {
  throw new Error("Playwright requires the fixed Docker image. Run npm run test:browser or npm run test:editor.");
}

const coverage = process.env.COVERAGE_BROWSER === "1";
export const viewServer = {
  command: "npx vite preview --config vite.views.config.ts --host 127.0.0.1 --port 4174 --strictPort",
  wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4174\// },
};
export const editorProjects = [
  { name: "editor-views", testDir: "./tests/editor/views", testMatch: "**/*.spec.ts", fullyParallel: true },
  { name: "editor-resources", testDir: "./tests/editor/renderer", testMatch: "**/*.spec.ts" },
];

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/browser",
  snapshotPathTemplate: "tests/{arg}{ext}",
  globalSetup: coverage ? "./scripts/browser-coverage-setup.mjs" : undefined,
  globalTeardown: coverage ? "./scripts/browser-coverage-teardown.mjs" : undefined,
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: 0,
  updateSnapshots: "none",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/playwright.json" }],
  ],
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "views", testDir: "./tests/views", testMatch: "**/*.spec.ts" },
    { name: "renderer", testDir: "./tests/renderer", testMatch: "**/*.spec.ts" },
  ],
  webServer: [
    {
      command: "npx vite preview --outDir dist --host 127.0.0.1 --port 4173 --strictPort",
      wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4173\// },
    },
    {
      command: "npx vite preview --outDir dist-debug --host 127.0.0.1 --port 4175 --strictPort",
      wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4175\// },
    },
    viewServer,
  ],
});
