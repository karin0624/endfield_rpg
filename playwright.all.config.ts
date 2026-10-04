import { defineConfig } from "@playwright/test";
import config, { editorProjects } from "./playwright.config";

// One serial run when a change affects both user rendering and developer editors.
export default defineConfig({
  ...config,
  projects: [...(config.projects ?? []), ...editorProjects],
});
