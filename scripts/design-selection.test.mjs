import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { prepareDesignSelection } from "./design-selection.mjs";

const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});

function font(family) {
  const name = Buffer.from(family, "utf16le").swap16();
  const bytes = Buffer.alloc(28 + 18 + name.length);
  bytes.writeUInt32BE(0x00010000, 0);
  bytes.writeUInt16BE(1, 4);
  bytes.write("name", 12);
  bytes.writeUInt32BE(28, 20);
  bytes.writeUInt32BE(18 + name.length, 24);
  bytes.writeUInt16BE(1, 30);
  bytes.writeUInt16BE(18, 32);
  bytes.writeUInt16BE(3, 34);
  bytes.writeUInt16BE(1, 36);
  bytes.writeUInt16BE(0x0409, 38);
  bytes.writeUInt16BE(1, 40);
  bytes.writeUInt16BE(name.length, 42);
  name.copy(bytes, 46);
  return bytes;
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "design-selection-"));
  temporary.push(root);
  const put = async (path, bytes) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), bytes);
  };
  const nodes = [
    {
      id: "button",
      type: "COMPONENT",
      source: { id: "guid/button" },
      childIds: ["label"],
      parentId: null,
      width: 120,
      height: 40,
      fills: [],
    },
    {
      id: "label",
      type: "TEXT",
      source: { id: "guid/label" },
      childIds: [],
      parentId: "button",
      fontFamily: "Game Serif",
      text: "決定",
    },
    {
      id: "screen",
      type: "FRAME",
      source: { id: "guid/screen" },
      childIds: ["instance"],
      parentId: null,
      width: 1920,
      height: 1080,
      fills: [],
    },
    {
      id: "instance",
      type: "INSTANCE",
      source: { id: "guid/instance" },
      childIds: [],
      parentId: "screen",
      componentId: "button",
      x: 20,
      y: 20,
    },
  ];
  const graph = {
    getAllNodes: () => nodes,
    getNode: (id) => nodes.find((node) => node.id === id),
    variables: new Map(),
    variableCollections: new Map(),
    images: new Map(),
    activeMode: new Map(),
  };
  const manifest = {
    targets: [
      {
        id: "button",
        kind: "component",
        storyId: "button--default",
        source: "src/Button.svelte",
        figma: { sourceId: "guid/button" },
      },
      {
        id: "screen",
        kind: "screen",
        storyId: "screen--default",
        source: "src/Screen.svelte",
        figma: { sourceId: "guid/screen" },
      },
    ],
  };
  const index = {
    v: 5,
    entries: {
      "button--default": { id: "button--default", type: "story", importPath: "./stories/Button.stories.ts" },
      "screen--default": { id: "screen--default", type: "story", importPath: "./stories/Screen.stories.ts" },
    },
  };
  const dependencies = {
    version: 1,
    stories: {
      "stories/Button.stories.ts": ["src/Button.svelte", "stories/Button.stories.ts", "src/theme.css"],
      "stories/Screen.stories.ts": [
        "src/Screen.svelte",
        "src/Button.svelte",
        "stories/Screen.stories.ts",
        "src/theme.css",
        "src/screen.css",
      ],
    },
  };
  await Promise.all([
    put("storybook/index.json", JSON.stringify(index)),
    put("storybook/design-dependencies.json", JSON.stringify(dependencies)),
    put("art-src/openpencil/fonts/game.ttf", font("Game Serif")),
    put("src/Button.svelte", "<button>決定</button>"),
    put("src/Screen.svelte", "<Button/>"),
    put("stories/Button.stories.ts", "export const Default = {};"),
    put("stories/Screen.stories.ts", "export const Default = {};"),
    put("src/theme.css", ":root {color: black}"),
    put("src/screen.css", ".screen {padding: 20px}"),
  ]);
  const options = {
    graph,
    manifest,
    storybookDirectory: "storybook",
    snapshotPath: "cache/snapshot.json",
    root,
    changed: true,
  };
  const save = async (snapshot) => put("cache/snapshot.json", JSON.stringify({ ...snapshot, verified: true }));
  return { root, put, nodes, options, index, dependencies, save };
}

it("requires a verified baseline and treats absent or unverified inputs as full change selection", async () => {
  const doc = await fixture();
  const first = await prepareDesignSelection(doc.options);
  expect(first).toMatchObject({
    selectedTargetIds: ["button", "screen"],
    scope: "changed",
    unchangedCount: 0,
    baseline: { available: false, reason: "missing" },
  });
  expect(first.snapshot.verified).toBe(false);
  await doc.put("cache/snapshot.json", JSON.stringify(first.snapshot));
  expect((await prepareDesignSelection(doc.options)).baseline.reason).toBe("unverified");
  await doc.save(first.snapshot);
  expect(await prepareDesignSelection(doc.options)).toMatchObject({
    selectedTargetIds: [],
    unchangedCount: 2,
    baseline: { available: true, reason: "verified" },
  });
});

it("selects only the affected story import closure, including parent screen dependencies", async () => {
  const doc = await fixture();
  await doc.save((await prepareDesignSelection(doc.options)).snapshot);
  await doc.put("src/screen.css", ".screen {padding: 24px}");
  const layout = await prepareDesignSelection(doc.options);
  expect(layout.selectedTargetIds).toEqual(["screen"]);
  expect(layout.changes.referenceChanged).toEqual([]);
  await doc.save(layout.snapshot);
  await doc.put("src/Button.svelte", "<button>変更</button>");
  expect((await prepareDesignSelection(doc.options)).selectedTargetIds).toEqual(["button", "screen"]);
});

it("records public runtime resources per target without hashing all public assets", async () => {
  const doc = await fixture();
  await doc.put("public/assets/background.png", "background-v1");
  await doc.put("public/assets/unrelated.png", "unused-v1");
  const options = { ...doc.options, resourceFiles: { button: [], screen: ["public/assets/background.png"] } };
  await doc.save((await prepareDesignSelection(options)).snapshot);
  await doc.put("public/assets/unrelated.png", "unused-v2");
  expect((await prepareDesignSelection(doc.options)).selectedTargetIds).toEqual([]);
  await doc.put("public/assets/background.png", "background-v2");
  expect((await prepareDesignSelection(doc.options)).selectedTargetIds).toEqual(["screen"]);
  await rm(join(doc.root, "public/assets/background.png"));
  expect((await prepareDesignSelection(doc.options)).selectedTargetIds).toEqual(["screen"]);
});

it("hashes bundled physical font files by their standard family names", async () => {
  const doc = await fixture();
  await doc.save((await prepareDesignSelection(doc.options)).snapshot);
  await doc.put("art-src/openpencil/fonts/unrelated.ttf", font("Unused Sans"));
  expect((await prepareDesignSelection(doc.options)).selectedTargetIds).toEqual([]);
  const bytes = await readFile(join(doc.root, "art-src/openpencil/fonts/game.ttf"));
  await doc.put("art-src/openpencil/fonts/game.ttf", Buffer.concat([bytes, Buffer.from([1])]));
  expect((await prepareDesignSelection(doc.options)).changes.referenceChanged).toEqual(["button", "screen"]);
});

it("supports explicit selection without writing or approving a baseline and rejects unknown cases", async () => {
  const doc = await fixture();
  const first = await prepareDesignSelection({ ...doc.options, select: ["button"] });
  expect(first).toMatchObject({ selectedTargetIds: ["button"], scope: "selected", snapshot: { verified: false } });
  await expect(readFile(join(doc.root, "cache/snapshot.json"))).rejects.toHaveProperty("code", "ENOENT");
  await expect(prepareDesignSelection({ ...doc.options, select: ["missing"] })).rejects.toThrow(
    "Unknown selected target: missing",
  );
});

it("keeps the default full run and exposes diff-only selection through the same contract", async () => {
  const doc = await fixture();
  await doc.save((await prepareDesignSelection(doc.options)).snapshot);
  expect((await prepareDesignSelection({ ...doc.options, changed: false })).selectedTargetIds).toEqual([
    "button",
    "screen",
  ]);
  expect(await prepareDesignSelection({ ...doc.options, changed: false, diffOnly: true })).toMatchObject({
    scope: "changed",
    selectedTargetIds: [],
  });
});

it("fails for missing stories and dependency indexes instead of skipping a component", async () => {
  const doc = await fixture();
  delete doc.index.entries["screen--default"];
  await doc.put("storybook/index.json", JSON.stringify(doc.index));
  await expect(prepareDesignSelection(doc.options)).rejects.toThrow("screen: missing Storybook story screen--default");
  doc.index.entries["screen--default"] = { type: "story", importPath: "./stories/Screen.stories.ts" };
  await doc.put("storybook/index.json", JSON.stringify(doc.index));
  delete doc.dependencies.stories["stories/Screen.stories.ts"];
  await doc.put("storybook/design-dependencies.json", JSON.stringify(doc.dependencies));
  await expect(prepareDesignSelection(doc.options)).rejects.toThrow("missing resolved Vite dependencies");
});

it("regenerates disposable incompatible or truncated JSON signatures by selecting all cases", async () => {
  const doc = await fixture();
  await doc.put("cache/snapshot.json", "{");
  expect((await prepareDesignSelection(doc.options)).baseline.reason).toBe("invalid-json");
  await doc.put("cache/snapshot.json", JSON.stringify({ version: 0, verified: true, targets: {} }));
  expect(await prepareDesignSelection(doc.options)).toMatchObject({
    selectedTargetIds: ["button", "screen"],
    baseline: { reason: "incompatible" },
  });
});
