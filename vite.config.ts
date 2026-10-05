import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { adventureSettingsPlugin } from "./scripts/adventure-settings-plugin.ts";
import { battleSettingsPlugin } from "./scripts/battle-settings-plugin.ts";

export default defineConfig({
  plugins: [svelte(), battleSettingsPlugin(), adventureSettingsPlugin()],
  // Keep production minification; hidden maps add no sourceMappingURL to served JavaScript.
  ...(process.env.COVERAGE_BROWSER === "1" ? { build: { sourcemap: "hidden" } } : {}),
});
