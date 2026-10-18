import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./.storybook/vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [storybookTest({ configDir: fileURLToPath(new URL(".storybook", import.meta.url)) })],
    test: {
      name: "storybook",
      allowOnly: false,
      retry: 0,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright({
          launchOptions: { args: ["--enable-unsafe-swiftshader"] },
          contextOptions: { deviceScaleFactor: 1, reducedMotion: "reduce" },
        }),
        instances: [{ browser: "chromium" }],
        viewport: { width: 1440, height: 1080 },
      },
    },
  }),
);
