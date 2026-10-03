import { defineConfig } from "vite";
import { adventureSettingsPlugin } from "./scripts/adventure-settings-plugin.ts";
import { battleSettingsPlugin } from "./scripts/battle-settings-plugin.ts";

export default defineConfig({
  plugins: [battleSettingsPlugin(), adventureSettingsPlugin()],
  // A separate analysis build; the ordinary distribution build stays unchanged.
  ...(process.env.COVERAGE_BROWSER === "1" ? { build: { sourcemap: "inline", minify: false, cssMinify: true } } : {}),
});
