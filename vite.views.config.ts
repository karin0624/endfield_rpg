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
      battle: resolve(import.meta.dirname, "tests/fixtures/battle-view.html"),
      dungeon: resolve(import.meta.dirname, "tests/fixtures/dungeon-view.html"),
      editor: resolve(import.meta.dirname, "tests/fixtures/editor-view.html"),
      renderer: resolve(import.meta.dirname, "tests/fixtures/renderer-view.html"),
      ground: resolve(import.meta.dirname, "tests/fixtures/ground-view.html"),
      partyApproved: resolve(import.meta.dirname, "tests/fixtures/party-approved.html"),
      partySelection: resolve(import.meta.dirname, "tests/fixtures/party-selection.html"),
      character: resolve(import.meta.dirname, "tests/fixtures/character-view.html"),
      reference: resolve(import.meta.dirname, "tests/fixtures/reference-view.html"),
      performance: resolve(import.meta.dirname, "tests/fixtures/performance-view.html"),
    },
    build: { outDir: "dist-views" },
  }),
);
