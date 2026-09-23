import { defineConfig } from "vite";
import { adventureSettingsPlugin } from "./scripts/adventure-settings-plugin.ts";
import { battleSettingsPlugin } from "./scripts/battle-settings-plugin.ts";

export default defineConfig({ plugins: [battleSettingsPlugin(), adventureSettingsPlugin()] });
