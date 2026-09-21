import { defineConfig } from "vite";
import { battleSettingsPlugin } from "./scripts/battle-settings-plugin.ts";

export default defineConfig({ plugins: [battleSettingsPlugin()] });
