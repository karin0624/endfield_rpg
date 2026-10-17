import { defineConfig } from "@playwright/test";
import config, { editorProjects } from "./playwright.config";

// Developer-only Native WebGL resource checks; editor appearance is not a visual contract.
export default defineConfig({
  ...config,
  outputDir: "test-results/editor",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/editor" }],
    ["json", { outputFile: "test-results/playwright-editor.json" }],
  ],
  projects: editorProjects,
  webServer: [],
});
