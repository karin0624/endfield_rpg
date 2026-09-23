import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (!existsSync("/.dockerenv")) {
  throw new Error("Playwright tests require the Docker container. Run npm run test:e2e or npm run test:editor.");
}

const editor = process.env.PLAYWRIGHT_EDITOR === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "built", testMatch: "battle.spec.ts" },
    { name: "settings", testMatch: "settings.spec.ts", use: { baseURL: "http://127.0.0.1:4174" } },
  ],
  webServer: editor
    ? [
        {
          command: "node scripts/serve-settings-test.mjs",
          wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4174\// },
          gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
        },
      ]
    : [
        {
          command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
          wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4173\// },
        },
      ],
});
