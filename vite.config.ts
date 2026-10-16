import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { settingsPlugin } from "./scripts/settings-plugin.ts";

export default defineConfig({
  plugins: [svelte(), settingsPlugin("battle"), settingsPlugin("adventure")],
  // Keep production minification; hidden maps add no sourceMappingURL to served JavaScript.
  ...(process.env.COVERAGE_BROWSER === "1" ? { build: { sourcemap: "hidden" } } : {}),
});
