import { defineConfig } from "@playwright/test";
import config, { editorProjects, viewServer } from "./playwright.config";

// Developer-only detail checks run when editors, authored settings or HMR change.
export default defineConfig({
  ...config,
  outputDir: "test-results/editor",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/editor" }],
    ["json", { outputFile: "test-results/playwright-editor.json" }],
  ],
  projects: editorProjects,
  webServer: [viewServer],
});
