import type { StorybookConfig } from "@storybook/svelte-vite";

const config: StorybookConfig = {
  stories: ["../tests/stories/**/*.stories.ts"],
  staticDirs: ["../public"],
  framework: {
    name: "@storybook/svelte-vite",
    options: { builder: { viteConfigPath: ".storybook/vite.config.ts" } },
  },
  viteFinal: (config) => ({
    ...config,
    build: { ...config.build, copyPublicDir: false },
  }),
  addons: ["@storybook/addon-vitest"],
  core: { disableTelemetry: true },
};

export default config;
