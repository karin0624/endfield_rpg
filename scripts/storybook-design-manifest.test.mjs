import { describe, expect, it } from "vitest";
import { assembleStoryDesigns } from "./storybook-design-manifest.mjs";

const settings = { version: 1, document: "design.fig", assets: [] };
const input = () => ({
  settings,
  index: {
    entries: {
      "button--primary": { type: "story", componentPath: "./src/web/button/Button.svelte" },
      "button--interaction": { type: "story", componentPath: "./src/web/button/Button.svelte" },
      "screen--home": { type: "story", componentPath: "./src/web/home/Home.svelte" },
    },
  },
  stories: {
    "button--primary": {
      parameters: {
        design: {
          kind: "component",
          component: "Button",
          host: { width: 240, className: "ui-screen" },
          viewport: { width: 800, height: 600 },
          capture: { selector: "button", padding: 8, background: "white" },
          targets: [
            { id: "button/primary", state: "primary", figma: { path: ["Components", "Button", "primary"] } },
            {
              id: "button/hover",
              state: "hover",
              figma: { path: ["Components", "Button", "hover"], properties: { label: "Save" } },
              interaction: [{ type: "hover", selector: "button" }],
            },
          ],
        },
      },
    },
    "button--interaction": { parameters: { design: { host: { padding: 16 } } } },
    "screen--home": {
      parameters: {
        design: {
          kind: "screen",
          viewport: { width: 1920, height: 1080 },
          targets: [{ id: "screen/home", state: "home", figma: { path: ["Screens", "Home"] } }],
        },
      },
    },
  },
});

describe("Storybook design metadata", () => {
  it("derives source, Story IDs and the variant inventory from prepared Story parameters", () => {
    const manifest = assembleStoryDesigns(input());
    expect(manifest.components).toEqual([
      {
        id: "Button",
        source: "src/web/button/Button.svelte",
        nodes: [{ path: ["Components", "Button", "hover"] }, { path: ["Components", "Button", "primary"] }],
        requiredStates: ["hover", "primary"],
      },
    ]);
    expect(manifest.targets.map(({ id, source, storyId }) => ({ id, source, storyId }))).toEqual([
      { id: "button/hover", source: "src/web/button/Button.svelte", storyId: "button--primary" },
      { id: "button/primary", source: "src/web/button/Button.svelte", storyId: "button--primary" },
      { id: "screen/home", source: "src/web/home/Home.svelte", storyId: "screen--home" },
    ]);
    expect(manifest.targets[0]).toMatchObject({
      renderFrame: { width: 240, className: "ui-screen", padding: 32 },
      viewport: { width: 800, height: 600 },
      capture: { selector: "button", padding: 8, background: "white" },
      figma: { properties: { label: "Save" } },
      interaction: [{ type: "hover", selector: "button" }],
    });
    expect(manifest.document).toBe("design.fig");
    expect(manifest.targets[2].renderFrame).toEqual({ padding: 0 });
  });

  it("rejects a duplicate target ID and two implementations for one design component", () => {
    const duplicate = input();
    duplicate.stories["button--primary"].parameters.design.targets[1].id = "button/primary";
    expect(() => assembleStoryDesigns(duplicate)).toThrow("Duplicate or missing design target id");
    const conflict = input();
    conflict.stories["screen--home"].parameters.design.kind = "component";
    conflict.stories["screen--home"].parameters.design.component = "Button";
    expect(() => assembleStoryDesigns(conflict)).toThrow("multiple implementations");
  });

  it("rejects a second handwritten inventory or derived source fields", () => {
    expect(() => assembleStoryDesigns({ ...input(), settings: { ...settings, targets: [] } })).toThrow(
      "document settings cannot contain a target inventory",
    );
    const source = input();
    source.stories["button--primary"].parameters.design.targets[0].source = "Other.svelte";
    expect(() => assembleStoryDesigns(source)).toThrow("Source, storyId and renderFrame are derived");
  });

  it("requires an indexed local component and an array of targets", () => {
    const missing = input();
    delete missing.index.entries["button--primary"].componentPath;
    expect(() => assembleStoryDesigns(missing)).toThrow("Missing componentPath");
    const invalid = input();
    invalid.index.entries["button--primary"].componentPath = "../outside/Button.svelte";
    expect(() => assembleStoryDesigns(invalid)).toThrow("local Svelte componentPath");
    const targets = input();
    targets.stories["button--primary"].parameters.design.targets = {};
    expect(() => assembleStoryDesigns(targets)).toThrow("design.targets array");
  });
});
