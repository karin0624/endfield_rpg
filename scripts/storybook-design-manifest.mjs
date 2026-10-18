import { posix } from "node:path";

const pathFromIndex = (value, storyId) => {
  if (typeof value !== "string") throw new Error(`Missing componentPath in Storybook index: ${storyId}`);
  const path = posix.normalize(value);
  if (posix.isAbsolute(path) || path.startsWith("../") || !path.endsWith(".svelte"))
    throw new Error(`Expected a local Svelte componentPath: ${storyId}`);
  return path;
};

/** Build the inventory from Storybook's prepared parameters, never a second handwritten mapping. */
export function assembleStoryDesigns({ settings, index, stories }) {
  if (settings.targets !== undefined || settings.components !== undefined)
    throw new Error(
      "Define design targets in Story parameters; the document settings cannot contain a target inventory",
    );
  const targets = [];
  const ids = new Set();
  for (const [storyId, story] of Object.entries(stories).sort(([a], [b]) => a.localeCompare(b))) {
    const design = story.parameters?.design;
    if (design?.targets === undefined) continue;
    if (!Array.isArray(design.targets)) throw new Error(`Expected design.targets array: ${storyId}`);
    const entry = index.entries?.[storyId];
    if (entry?.type !== "story") throw new Error(`Missing story in Storybook index: ${storyId}`);
    const source = pathFromIndex(entry.componentPath, storyId);
    for (const declared of design.targets) {
      if (!declared || typeof declared !== "object" || Array.isArray(declared))
        throw new Error(`Expected a design target: ${storyId}`);
      if (declared.source !== undefined || declared.storyId !== undefined || declared.renderFrame !== undefined)
        throw new Error(`Source, storyId and renderFrame are derived from Storybook: ${storyId}`);
      if (typeof declared.id !== "string" || !declared.id.length || ids.has(declared.id))
        throw new Error(`Duplicate or missing design target id: ${declared.id}`);
      ids.add(declared.id);
      const defaults = Object.fromEntries(
        ["kind", "component", "viewport", "capture"]
          .filter((key) => design[key] !== undefined)
          .map((key) => [key, design[key]]),
      );
      const target = { ...defaults, ...declared, source, storyId };
      target.renderFrame =
        target.kind === "screen" ? { padding: 0 } : { ...design.host, padding: design.host?.padding ?? 32 };
      targets.push(target);
    }
  }
  targets.sort((a, b) => a.id.localeCompare(b.id));
  const components = new Map();
  for (const target of targets) {
    if (target.kind !== "component") continue;
    if (typeof target.component !== "string" || !target.component.length)
      throw new Error(`Missing design component identity: ${target.id}`);
    let component = components.get(target.component);
    if (!component) {
      component = { id: target.component, source: target.source, nodes: [], requiredStates: [] };
      components.set(target.component, component);
    }
    if (component.source !== target.source)
      throw new Error(`Design component maps to multiple implementations: ${target.component}`);
    const reference = target.figma?.path
      ? { path: target.figma.path }
      : target.figma?.sourceId
        ? { sourceId: target.figma.sourceId }
        : undefined;
    if (!reference) throw new Error(`Missing Figma node reference: ${target.id}`);
    if (!component.nodes.some((node) => JSON.stringify(node) === JSON.stringify(reference)))
      component.nodes.push(reference);
    if (!component.requiredStates.includes(target.state)) component.requiredStates.push(target.state);
  }
  return { ...settings, components: [...components.values()], targets };
}

/** Extract merged parameters through Storybook's public preview API without rendering each Story or running play. */
export async function collectStoryDesigns({ page, storybookURL, settings }) {
  await page.goto(new URL("iframe.html?viewMode=story", storybookURL).href);
  await page.waitForFunction(() => Boolean(window.__STORYBOOK_PREVIEW__));
  const { index, stories } = await page.evaluate(async () => {
    const preview = window.__STORYBOOK_PREVIEW__;
    await preview.ready();
    const response = await fetch("index.json");
    if (!response.ok) throw new Error(`Cannot load Storybook index: ${response.status}`);
    const index = await response.json();
    const prepared = await preview.extract();
    const stories = Object.fromEntries(
      Object.entries(prepared).map(([id, story]) => [id, { parameters: { design: story.parameters.design } }]),
    );
    return { index, stories };
  });
  return assembleStoryDesigns({ settings, index, stories });
}
