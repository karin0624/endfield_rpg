import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vite";
import config from "./vite.config.ts";

// Distinct direct-state HTML entries share the production minifier. They are never shipped in dist.
export default mergeConfig(
  config,
  defineConfig({
    base: "/rpg/",
    input: {
      campaign: resolve(import.meta.dirname, "tests/fixtures/campaign-view.html"),
      adventure: resolve(import.meta.dirname, "tests/fixtures/adventure-view.html"),
      partyApproved: resolve(import.meta.dirname, "tests/fixtures/party-approved.html"),
      partySelection: resolve(import.meta.dirname, "tests/fixtures/party-selection.html"),
    },
    build: { outDir: "dist-views" },
  }),
);
