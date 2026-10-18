import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { afterEach, expect, it } from "vitest";
import { comparePNG } from "./compare-png.mjs";
import { exportDesignAssets } from "./export-design-assets.mjs";
import {
  assertCompositeCoverage,
  assertDesignBrowserScreen,
  assertNativeAnimationClock,
  assertNativeAnimationDestination,
  assertPaintContained,
  assertPressedCapture,
  assertSelectPopupProperties,
  assertSourcePlatformPhase,
  captureCaret,
  captureGeometry,
  clearCaptureBoundary,
  cropPNG,
  designBrowserCapture,
  emptyViewportReadback,
  nativeAnimationTime,
  nativeCapturePlacement,
  nativeGeometryMatches,
  nativeSizing,
  observeCaretBitmap,
  observeCompositeProperties,
  observeSelectPopupBitmap,
  resolveCaptureSource,
  resolveCompositeClone,
  resolveCompositeComponent,
  resolveFigmaNode,
  resolveNativeInteractions,
  resolveNativeScroll,
  setComponentProperties,
  setNestedComponentProperties,
  validateBindings,
  writeSharedExport,
} from "./verify-design-bindings.mjs";

const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});

it("uses an OS browser only for the pointer action capability in both capture phases", () => {
  expect(designBrowserCapture().headless).toBe(true);
  expect(designBrowserCapture().args).toContain("--disable-partial-raster");
  expect(designBrowserCapture({ interaction: { type: "pressed", selector: "select" } }).headless).toBe(true);
  const pointer = { type: "pointer", selector: "select", position: { x: 10, y: 60 } };
  const source = designBrowserCapture({ interaction: [{ type: "focus", selector: "select" }, pointer] });
  expect(source).toMatchObject({ channel: "chromium", headless: false });
  expect(designBrowserCapture({ interaction: pointer })).toEqual(source);
  expect(designBrowserCapture({ id: "another-control", storyId: "control--default", interaction: pointer })).toEqual(
    source,
  );
  expect(designBrowserCapture({ interaction: { type: "hover", selector: "input" } }).channel).toBeUndefined();
});

it("rejects a physical display mismatch even when the emulated viewport is correct", () => {
  const screen = {
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    devicePixelRatio: 1,
    colorDepth: 24,
    isPrimary: true,
    isExtended: false,
    id: "2300000000",
  };
  expect(assertDesignBrowserScreen({ screenInfos: [screen] })).toEqual(
    Object.fromEntries(Object.entries(screen).filter(([property]) => property !== "id")),
  );
  expect(() => assertDesignBrowserScreen({ screenInfos: [{ ...screen, width: 800, height: 600 }] })).toThrow(
    "Physical browser display width",
  );
  expect(() => assertDesignBrowserScreen({ screenInfos: [{ ...screen, availHeight: 1040 }] })).toThrow("availHeight");
  expect(() => assertDesignBrowserScreen({ screenInfos: [{ ...screen, devicePixelRatio: 2 }] })).toThrow(
    "devicePixelRatio",
  );
  expect(() => assertDesignBrowserScreen({ screenInfos: [screen, screen] })).toThrow("one physical");
});

it("keeps fractional geometry and expands only the PNG pixel boundary", () => {
  expect(
    captureGeometry(
      { x: 115, y: 516.609375, width: 384, height: 43.1875 },
      { top: 96, right: 16, bottom: 16, left: 16 },
    ),
  ).toEqual({ clip: { x: 99, y: 420, width: 416, height: 156 }, phase: { x: 0, y: 0.609375 } });
  expect(captureGeometry({ x: 32.25, y: 64.75, width: 272.5, height: 88.25 }, 16)).toEqual({
    clip: { x: 16, y: 48, width: 305, height: 121 },
    phase: { x: 0.25, y: 0.75 },
  });
  expect(captureGeometry({ x: -0.25, y: -0.5, width: 10.5, height: 11.25 }, 0)).toEqual({
    clip: { x: -1, y: -1, width: 12, height: 12 },
    phase: { x: 0.75, y: 0.5 },
  });
  expect(captureGeometry({ x: 323.4296875, y: 22.1015625, width: 87.515625, height: 19.5 }, 16)).toEqual({
    clip: { x: 307, y: 6, width: 120, height: 52 },
    phase: { x: 0.4296875, y: 0.1015625 },
  });
});

it("copies all RGBA channels from a viewport without resampling or removing paint", () => {
  const viewport = new PNG({ width: 4, height: 3 });
  for (let i = 0; i < viewport.data.length; i++) viewport.data[i] = (i * 37) % 256;
  const clip = { x: 1, y: 1, width: 2, height: 2 };
  const cropped = PNG.sync.read(cropPNG(PNG.sync.write(viewport), clip));
  expect([cropped.width, cropped.height]).toEqual([2, 2]);
  expect([...cropped.data]).toEqual([...viewport.data.subarray(20, 28), ...viewport.data.subarray(36, 44)]);
  expect(() => cropPNG(PNG.sync.write(viewport), { ...clip, x: 1.5 })).toThrow("integer bounds");
  expect(() => cropPNG(PNG.sync.write(viewport), { ...clip, width: 4 })).toThrow("within the viewport");
});

it("acknowledges an empty readback only for the complete viewport with every RGBA byte zero", () => {
  const image = new PNG({ width: 4, height: 3 });
  expect(emptyViewportReadback(PNG.sync.write(image), { width: 4, height: 3 })).toEqual({
    width: 4,
    height: 3,
    rgbaBytes: 48,
    allZero: true,
  });
  expect(emptyViewportReadback(PNG.sync.write(image), { width: 4, height: 2 })).toBeUndefined();
  for (const channel of [0, 1, 2, 3]) {
    image.data.fill(0);
    image.data[20 + channel] = 1;
    expect(emptyViewportReadback(PNG.sync.write(image), { width: 4, height: 3 })).toBeUndefined();
  }
});

it("requires exact fixed intrinsic dimensions and exact native dynamic HUG layout dimensions", () => {
  const nominal = { x: 48, y: 28, width: 144, height: 57.59375 };
  const declared = nativeSizing({
    width: 262,
    height: 84,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "HUG",
    counterAxisSizing: "HUG",
  });
  expect(nativeGeometryMatches(nominal, nominal, declared)).toBe(true);
  expect(nativeGeometryMatches(nominal, { ...nominal, width: 144.015625 }, declared)).toBe(false);
  expect(nativeGeometryMatches(nominal, nominal, { ...declared, hugs: { x: false, y: true } })).toBe(false);
  const edge = { x: 64, y: 128, width: 783.9998779296875, height: 173 };
  const fixed = nativeSizing(edge);
  expect(nativeGeometryMatches(edge, { ...edge, width: 783.984375 }, fixed)).toBe(true);
  expect(nativeGeometryMatches({ ...edge, width: 784 }, edge, fixed)).toBe(false);
  expect(nativeGeometryMatches(edge, { ...edge, x: 64.015625 }, fixed)).toBe(false);
});

it("preserves a centered Hug anchor when cached graph dimensions differ from content layout", () => {
  const nominal = { x: 720, y: 467.203125, width: 480, height: 145.59375 };
  const node = {
    width: 480,
    height: 146,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "HUG",
    counterAxisSizing: "FIXED",
    horizontalConstraint: "CENTER",
    verticalConstraint: "CENTER",
  };
  expect(nativeCapturePlacement(nominal, { x: 0, y: 0 }, node)).toEqual({ x: 720, y: 467 });
  expect(nativeCapturePlacement(nominal, { x: 64, y: 32 }, node)).toEqual({ x: 656, y: 435 });
  expect(nativeCapturePlacement(nominal, { x: 0, y: 0 }, { ...node, verticalConstraint: "MIN" })).toEqual({
    x: 720,
    y: 467.203125,
  });
  expect(nativeCapturePlacement(nominal, { x: 0, y: 0 }, { ...node, primaryAxisSizing: "FIXED" })).toEqual({
    x: 720,
    y: 467.203125,
  });
});

it("requires an explicit finite native millisecond clock with paused-animation capture", () => {
  expect(nativeAnimationTime({ figma: {} })).toBeUndefined();
  for (const time of [0, 48, 120, 500, 1000.25])
    expect(nativeAnimationTime({ figma: { animationTime: time }, capture: { animations: "allow" } })).toBe(time);
  for (const time of [-1, NaN, Infinity, -Infinity, "500", null, {}])
    expect(() => nativeAnimationTime({ figma: { animationTime: time }, capture: { animations: "allow" } })).toThrow(
      "finite nonnegative",
    );
  for (const policy of [undefined, "disabled"])
    expect(() => nativeAnimationTime({ figma: { animationTime: 500 }, capture: { animations: policy } })).toThrow(
      "animations=allow",
    );
  const { graph, manifest } = contract();
  manifest.targets[1].figma.animationTime = 500;
  expect(validateBindings(manifest, graph)).toContain(
    "button-default: Native animationTime requires capture.animations=allow",
  );
  manifest.targets[1].capture.animations = "allow";
  expect(validateBindings(manifest, graph)).toEqual([]);
});

it("rejects absent, running, pending, duplicate or drifting native animation observations", () => {
  const observation = { id: "open-pencil-prototype:owner:caret:opacity", state: "paused", pending: false, time: 500 };
  expect(() => assertNativeAnimationClock(500, [observation])).not.toThrow();
  expect(() => assertNativeAnimationClock(0, [{ ...observation, time: 0 }])).not.toThrow();
  for (const observations of [[], undefined])
    expect(() => assertNativeAnimationClock(500, observations)).toThrow("active saved prototype");
  expect(() => assertNativeAnimationClock(500, [observation, { ...observation }])).toThrow(
    "unique animation identities",
  );
  expect(() => assertNativeAnimationClock(500, [{ ...observation, id: "" }])).toThrow("unique animation identities");
  for (const changes of [
    { state: "running" },
    { state: "finished" },
    { pending: true },
    { time: 500.00001 },
    { time: null },
  ])
    expect(() => assertNativeAnimationClock(500, [{ ...observation, ...changes }])).toThrow("requested paused time");
  expect(() => assertNativeAnimationClock(Infinity, [observation])).toThrow("finite nonnegative");
});

function animationDestination(time = 120) {
  const expected = { mainId: "end", entryMainId: "start", ownerNodeId: "exported-owner" };
  return {
    expected,
    observation: {
      animations: [{ id: "motion", state: "paused", pending: false, time, iterations: 1 }],
      programs: [
        {
          ownerNodeId: expected.ownerNodeId,
          animationIds: ["motion"],
          endpoints: [
            { variantId: "start", at: 0 },
            { variantId: "end", at: 120 },
          ],
          segments: [{ sourceId: "start", destinationId: "end", start: 0, end: 120 }],
          variantId: "end",
        },
      ],
    },
  };
}

it("counts the registered destination only at its actual owner's exact endpoint or finite settled end", () => {
  for (const time of [120, 140]) {
    const { expected, observation } = animationDestination(time);
    expect(assertNativeAnimationDestination(expected, time, observation)).toEqual({
      ownerNodeId: "exported-owner",
      mainId: "end",
      endpoint: 120,
      time,
      afterFinal: time > 120,
    });
  }
  const { expected, observation } = animationDestination(0);
  Object.assign(observation.programs[0], { variantId: "start", targetId: "end", progress: "0" });
  expect(assertNativeAnimationDestination({ ...expected, mainId: "start" }, 0, observation).endpoint).toBe(0);
});

it("rejects unreachable states, another or ambiguous owner, intermediate poses and undeclared entry clocks", () => {
  const base = animationDestination();
  expect(() =>
    assertNativeAnimationDestination({ ...base.expected, mainId: "unreached" }, 120, base.observation),
  ).toThrow("not reached");
  expect(() =>
    assertNativeAnimationDestination({ ...base.expected, ownerNodeId: "other" }, 120, base.observation),
  ).toThrow("unambiguous exported owner");
  expect(() =>
    assertNativeAnimationDestination({ ...base.expected, entryMainId: "other" }, 120, base.observation),
  ).toThrow("saved entry");
  const ambiguous = structuredClone(base.observation);
  ambiguous.programs.push(structuredClone(ambiguous.programs[0]));
  expect(() => assertNativeAnimationDestination(base.expected, 120, ambiguous)).toThrow("unambiguous exported owner");
  const wrongTrack = structuredClone(base.observation);
  wrongTrack.programs[0].animationIds = ["other-owner-track"];
  expect(() => assertNativeAnimationDestination(base.expected, 120, wrongTrack)).toThrow(
    "matching actual owner animations",
  );
  const middle = animationDestination(60);
  Object.assign(middle.observation.programs[0], { variantId: "start", targetId: "end", progress: "0.5" });
  expect(() => assertNativeAnimationDestination(middle.expected, 60, middle.observation)).toThrow("not reached");
  expect(() =>
    assertNativeAnimationDestination({ ...middle.expected, mainId: "start" }, 60, middle.observation),
  ).toThrow("exact endpoint");
  const held = animationDestination(60);
  Object.assign(held.observation.programs[0], { variantId: "start", segments: [] });
  expect(() => assertNativeAnimationDestination({ ...held.expected, mainId: "start" }, 60, held.observation)).toThrow(
    "exact endpoint",
  );
  const looping = animationDestination(140);
  looping.observation.animations[0].iterations = "Infinity";
  expect(() => assertNativeAnimationDestination(looping.expected, 140, looping.observation)).toThrow(
    "finite final endpoint",
  );
  const active = structuredClone(base.observation);
  active.programs[0].targetId = "unexpected-active-target";
  expect(() => assertNativeAnimationDestination(base.expected, 120, active)).toThrow("not reached");
  const drifting = structuredClone(base.observation);
  drifting.animations[0].time = 120.000001;
  expect(() => assertNativeAnimationDestination(base.expected, 120, drifting)).toThrow("requested paused time");
});

function contract() {
  const nodes = [
    { id: "page", type: "CANVAS", name: "Screens" },
    { id: "screen", type: "FRAME", name: "Home", parentId: "page" },
    { id: "button-default", type: "COMPONENT", name: "state=default", parentId: "page" },
    { id: "button-hover", type: "COMPONENT", name: "state=hover", parentId: "page" },
  ];
  const graph = {
    getNode: (id) => nodes.find((node) => node.id === id),
    getAllNodes: () => nodes,
    getPages: () => [nodes[0]],
    getChildren: (id) => nodes.filter((node) => node.parentId === id),
    getMainComponent: (id) =>
      nodes.find((node) => node.id === nodes.find((instance) => instance.id === id)?.componentId),
  };
  const manifest = {
    version: 1,
    document: "design.fig",
    components: [
      {
        id: "button",
        source: "src/Button.svelte",
        nodes: [{ path: ["Screens", "state=default"] }, { path: ["Screens", "state=hover"] }],
        requiredStates: ["default", "hover"],
      },
    ],
    targets: [
      {
        id: "home",
        kind: "screen",
        source: "src/Home.svelte",
        state: "default",
        figma: { path: ["Screens", "Home"] },
        storyId: "screens-home--default",
        viewport: { width: 1920, height: 1080 },
      },
      ...["default", "hover"].map((state) => ({
        id: `button-${state}`,
        kind: "component",
        component: "button",
        state,
        figma: { path: ["Screens", `state=${state}`] },
        storyId: "hub-button--default",
        viewport: { width: 640, height: 480 },
        capture: { selector: "button", padding: 16, background: "transparent" },
        ...(state === "hover" ? { interaction: { type: "hover", selector: "button" } } : {}),
      })),
    ],
  };
  return { graph, manifest };
}

function addArtwork(manifest, graph) {
  graph.getAllNodes().push({ id: "artwork", type: "COMPONENT", name: "Artwork", parentId: "page" });
  manifest.assets = [{ id: "artwork", source: "public/assets/artwork.png", nodes: [{ path: ["Screens", "Artwork"] }] }];
}

it("rejects manual capture coordinates for independently rendered components", () => {
  const { graph, manifest } = contract();
  manifest.targets[1].capture.phase = { x: 0.5, y: 0.25 };
  expect(validateBindings(manifest, graph)).toContain(
    "Manual capture phase is unsupported; render an independent story: button-default",
  );
});

it("registers editable artwork without requiring comparison states and keeps UI coverage strict", () => {
  const { graph, manifest } = contract();
  addArtwork(manifest, graph);
  graph.getAllNodes().push({
    id: "placed-artwork",
    type: "INSTANCE",
    name: "Artwork instance",
    componentId: "artwork",
    parentId: "button-default",
  });
  expect(validateBindings(manifest, graph)).toEqual([]);
  manifest.targets.pop();
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Unverified native component/variant: button-hover",
      "Unverified implemented state: button/hover",
    ]),
  );
  graph.getAllNodes().push({ id: "unregistered-ui", type: "COMPONENT", name: "New UI", parentId: "page" });
  expect(validateBindings(manifest, graph)).toContain("Unregistered native component: unregistered-ui New UI");
});

it("rejects assets as direct comparison targets or covered component responsibilities", () => {
  const { graph, manifest } = contract();
  addArtwork(manifest, graph);
  const target = structuredClone(manifest.targets[1]);
  Object.assign(target, { id: "asset-target", component: "artwork", figma: { path: ["Screens", "Artwork"] } });
  manifest.targets.push(target);
  expect(validateBindings(manifest, graph)).toContain("Design assets must not be comparison targets: asset-target");
  target.kind = "screen";
  expect(validateBindings(manifest, graph)).toContain("Design assets must not be comparison targets: asset-target");
  manifest.targets.pop();
  manifest.targets[0].covers = [{ component: "artwork" }];
  expect(validateBindings(manifest, graph)).toContain("home: Design assets must not be covered components");
});

it("rejects malformed asset inventories and duplicate component or asset ownership", () => {
  const { graph, manifest } = contract();
  manifest.assets = {};
  expect(validateBindings(manifest, graph)).toContain("Expected assets inventory");
  manifest.assets = [null, { id: "broken" }];
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Expected asset inventory entry",
      "Missing asset source: broken",
      "Missing asset nodes: broken",
    ]),
  );
  addArtwork(manifest, graph);
  manifest.assets.push(structuredClone(manifest.assets[0]));
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining(["Duplicate or missing asset id: artwork", "Asset node registered more than once: artwork"]),
  );
  manifest.assets.pop();
  manifest.assets[0].id = "button";
  manifest.assets[0].nodes = [{ path: ["Screens", "state=default"] }];
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Duplicate or missing asset id: button",
      "Asset node registered more than once: button-default",
    ]),
  );
  manifest.assets[0].nodes = [{ path: ["Screens", "Home"] }, { path: ["Screens", "Missing"] }];
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Expected native asset COMPONENT: screen",
      'button: Expected one Figma path step ["Screens","Missing"]; found 0',
    ]),
  );
});

it("exports only explicitly inventoried SVG assets and preserves the ordinary exporter bytes", async () => {
  const path = await mkdtemp(join(tmpdir(), "design-assets-"));
  temporary.push(path);
  await mkdir(join(path, "packages/core/dist"), { recursive: true });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>\n';
  await writeFile(
    join(path, "packages/core/dist/index.js"),
    `
    const main = {id:"artwork",source:{id:"artwork"},type:"COMPONENT",exportSettings:[{format:"svg"}]};
    export const parseFigFile = async () => ({getAllNodes:()=>[main]});
    export const svgFormat = {exportContent:async()=>({data:${JSON.stringify(svg)}})};
  `,
  );
  const document = join(path, "design.fig"),
    bindings = join(path, "bindings.json");
  await writeFile(document, "test document");
  const asset = { id: "artwork", source: "public/assets/artwork.svg", nodes: [{ sourceId: "artwork" }] };
  const manifest = {
    document,
    assets: [asset, { id: "photo", source: "public/assets/photo.png", nodes: [{ sourceId: "photo" }] }],
    components: [{ id: "ui", source: "public/assets/must-not-export.svg", nodes: [{ sourceId: "missing" }] }],
  };
  await writeFile(bindings, JSON.stringify(manifest));
  const report = await exportDesignAssets(path, { bindings, output: path });
  expect(report.assets).toEqual([
    expect.objectContaining({ asset: "artwork", filename: "public/assets/artwork.svg", bytes: Buffer.byteLength(svg) }),
  ]);
  expect(await readFile(join(path, "public/assets/artwork.svg"), "utf8")).toBe(svg);
  expect(await readdir(join(path, "public/assets"))).toEqual(["artwork.svg"]);
  asset.source = "public/assets/../../escape.svg";
  await writeFile(bindings, JSON.stringify(manifest));
  await expect(exportDesignAssets(path, { bindings, output: path })).rejects.toThrow(
    "project-relative public/assets path",
  );
});

it("captures a saved instance of the registered main without substituting another component", () => {
  const { graph, manifest } = contract();
  const target = manifest.targets[1];
  const nodes = graph.getAllNodes();
  nodes.push({
    id: "placed",
    name: "Placed button",
    type: "INSTANCE",
    componentId: "button-default",
    parentId: "screen",
  });
  expect(resolveCaptureSource(graph, target).id).toBe("button-default");
  target.figma.instance = { path: ["Screens", "Home", "Placed button"] };
  expect(resolveCaptureSource(graph, target).id).toBe("placed");
  expect(validateBindings(manifest, graph)).toEqual([]);
  graph.getNode("placed").componentId = "button-hover";
  expect(() => resolveCaptureSource(graph, target)).toThrow("registered main component");
  expect(validateBindings(manifest, graph)).toContain(
    "button-default: Figma instance capture must use the registered main component",
  );
  target.figma.instance = { path: ["Screens", "Home"] };
  expect(() => resolveCaptureSource(graph, target)).toThrow("saved INSTANCE");
  manifest.targets[0].figma.instance = { path: ["Screens", "Home", "Placed button"] };
  expect(() => resolveCaptureSource(graph, manifest.targets[0])).toThrow("native COMPONENT target");
});

it("runs native prototype interactions only through unique triggers in the exported target", () => {
  const { graph, manifest } = contract();
  const original = graph.getNode("screen");
  const nodes = graph.getAllNodes();
  nodes.push(
    { id: "trigger", name: "Open", type: "RECTANGLE", parentId: original.id },
    { id: "copy", name: "Home copy", type: "FRAME", parentId: "page" },
    { id: "trigger-copy", name: "Open", type: "RECTANGLE", parentId: "copy" },
  );
  const actions = [{ type: "click", node: { path: ["Screens", "Home", "Open"] } }];
  expect(resolveNativeInteractions(original, graph.getNode("copy"), actions, graph)).toEqual([
    { type: "click", nodeId: "trigger-copy" },
  ]);
  manifest.targets[0].figma.interactions = actions;
  expect(validateBindings(manifest, graph)).toContain("Unverified screen frame: copy Home copy");
  expect(validateBindings(manifest, graph, { complete: false })).toEqual([]);
  expect(() => resolveNativeInteractions(original, original, {}, graph)).toThrow("must be an array");
  expect(() =>
    resolveNativeInteractions(original, original, [{ type: "hover", node: actions[0].node }], graph),
  ).toThrow("must declare a click");
  expect(() =>
    resolveNativeInteractions(
      original,
      original,
      [{ type: "click", node: { path: ["Screens", "state=default"] } }],
      graph,
    ),
  ).toThrow("outside the exported");
  nodes.push({ id: "ambiguous", name: "Open", type: "RECTANGLE", parentId: "copy" });
  expect(() => resolveNativeInteractions(original, graph.getNode("copy"), actions, graph)).toThrow("found 2");
});

it("requires every overlay destination to be captured directly or activated by a bound saved click", () => {
  const { graph, manifest } = contract();
  const nodes = graph.getAllNodes();
  nodes.push(
    { id: "overlay", name: "Settings", type: "FRAME", parentId: "page" },
    {
      id: "trigger",
      name: "Open",
      type: "RECTANGLE",
      parentId: "screen",
      reactions: [
        { trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", navigation: "OVERLAY", destinationId: "overlay" }] },
      ],
    },
  );
  expect(validateBindings(manifest, graph)).toContain("Unverified screen frame: overlay Settings");
  manifest.targets[0].figma.interactions = [{ type: "click", node: { path: ["Screens", "Home", "Open"] } }];
  expect(validateBindings(manifest, graph)).toEqual([]);
  graph.getNode("trigger").reactions[0].actions.push({ type: "NODE", navigation: "OVERLAY", destinationId: "overlay" });
  expect(validateBindings(manifest, graph)).toContain("Unverified screen frame: overlay Settings");
  graph.getNode("trigger").reactions[0].actions.pop();
  graph.getNode("overlay").type = "RECTANGLE";
  expect(validateBindings(manifest, graph)).toContain("home: Native overlay destination must reference a FRAME");
});

it("requires every native component, variant, implemented state and complete screen", () => {
  const { graph, manifest } = contract();
  expect(validateBindings(manifest, graph)).toEqual([]);
  manifest.targets = manifest.targets.filter((target) => target.id !== "button-hover");
  manifest.components[0].nodes = [{ path: ["Screens", "state=default"] }];
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Unregistered native component: button-hover state=hover",
      "Unverified implemented state: button/hover",
    ]),
  );
  manifest.components[0].nodes.push({ path: ["Screens", "state=hover"] });
  manifest.targets = manifest.targets.filter((target) => target.kind !== "screen");
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Unverified native component/variant: button-hover",
      "Unverified screen frame: screen Home",
    ]),
  );
});

it("also refuses an unbound screen on a separate migration screen page", () => {
  const { graph, manifest } = contract();
  const pages = graph.getPages();
  const migration = { id: "migration", type: "CANVAS", name: "Screens / DS未対応" };
  graph.getPages = () => [...pages, migration];
  graph
    .getAllNodes()
    .push(migration, { id: "legacy-screen", type: "FRAME", name: "Conversation", parentId: "migration" });
  expect(validateBindings(manifest, graph)).toContain("Unverified screen frame: legacy-screen Conversation");
});

it("keeps native key input explicit so normal focus and text selection can both be verified", () => {
  const { graph, manifest } = contract();
  manifest.targets[1].interaction = [
    { type: "focus", selector: "input" },
    { type: "key", key: "ControlOrMeta+A", selector: "input" },
  ];
  expect(validateBindings(manifest, graph)).toEqual([]);
  manifest.targets[1].interaction[1].key = "";
  expect(validateBindings(manifest, graph)).toContain("Invalid native interaction: button-default");
});

it("validates explicit paused-animation capture and every side of popup outsets", () => {
  const { graph, manifest } = contract();
  manifest.targets[1].capture.padding = { top: 96, right: 16, bottom: 16, left: 16 };
  manifest.targets[1].capture.animations = "allow";
  manifest.targets[1].capture.reducedMotion = "no-preference";
  expect(validateBindings(manifest, graph)).toEqual([]);
  manifest.targets[1].capture.padding.left = 0.5;
  manifest.targets[1].capture.animations = "ignore";
  manifest.targets[1].capture.reducedMotion = "ignore";
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Capture padding must use nonnegative integer pixels: button-default",
      "Invalid capture animation policy: button-default",
      "Invalid capture reduced-motion preference: button-default",
    ]),
  );
});

it("keeps popup pointer movement and button release explicit native interactions", () => {
  const { graph, manifest } = contract();
  manifest.targets[1].interaction = [
    { type: "pressed", selector: "select" },
    { type: "release", selector: "select" },
    { type: "pointer", selector: "select", position: { x: 32, y: -44.609375 } },
  ];
  expect(validateBindings(manifest, graph)).toEqual([]);
  manifest.targets[1].interaction[2].position.y = Number.NaN;
  expect(validateBindings(manifest, graph)).toContain("Invalid native interaction: button-default");
});

it("validates a relative control position and the final pressed value without allowing keyboard or intermediate expectations", () => {
  const { graph, manifest } = contract();
  const press = { type: "pressed", selector: "input", position: { x: 20.5, y: 12.25 }, expectedValue: "2" };
  manifest.targets[1].interaction = [{ type: "hover", selector: "input" }, press];
  expect(validateBindings(manifest, graph)).toEqual([]);
  for (const invalid of [
    { ...press, position: { x: -1, y: 1 } },
    { ...press, position: { x: 1, y: Number.NaN } },
    { ...press, method: "keyboard" },
    { ...press, expectedValue: 2 },
  ]) {
    manifest.targets[1].interaction = [invalid];
    expect(validateBindings(manifest, graph)).toContain("Invalid native interaction: button-default");
  }
  manifest.targets[1].interaction = [press, { type: "release", selector: "input" }];
  expect(validateBindings(manifest, graph)).toContain("Invalid native interaction: button-default");
});

it("rejects auto-repeat, lost activation, replaced value and paint changes during a pressed capture", () => {
  const before = {
    connected: true,
    control: "input",
    value: "2",
    box: { x: 1, y: 2, width: 430, height: 46.78125 },
    states: { active: true, hover: true, focus: true },
    style: { color: "rgb(236, 233, 223)" },
  };
  expect(() => assertPressedCapture(before, structuredClone(before), "2")).not.toThrow();
  expect(() => assertPressedCapture(before, { ...before, value: "3" }, "2")).toThrow("must remain");
  expect(() => assertPressedCapture(before, { ...before, value: "3" })).toThrow("changed during capture");
  expect(() => assertPressedCapture(before, before, "1")).toThrow("must remain");
  expect(() => assertPressedCapture(before, { ...before, states: { ...before.states, active: false } }, "2")).toThrow(
    "active and hovered",
  );
  expect(() => assertPressedCapture(before, { ...before, box: { ...before.box, y: 2.015625 } }, "2")).toThrow(
    "geometry",
  );
  expect(() => assertPressedCapture(before, { ...before, style: { color: "rgb(237, 233, 223)" } }, "2")).toThrow(
    "style",
  );
  const selected = { ...before, selection: { text: "2", start: null, end: null, direction: null } };
  expect(() =>
    assertPressedCapture(selected, { ...selected, selection: { ...selected.selection, text: "" } }, "2"),
  ).toThrow("changed during capture");
});

it("rejects duplicate bindings, missing nodes, fractional viewports and cropped screens", () => {
  const { graph, manifest } = contract();
  manifest.targets[0].capture = { selector: "button", padding: 0 };
  manifest.targets[1].figma.path = ["Screens", "missing"];
  manifest.targets[1].viewport.width = 320.5;
  manifest.targets[2].id = manifest.targets[1].id;
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Screens must capture the full viewport: home",
      'button-default: Expected one Figma path step ["Screens","missing"]; found 0',
      "Viewport must use positive integer pixels: button-default",
      "Duplicate or missing target id: button-default",
    ]),
  );
  expect(validateBindings({ version: 1, document: "design.fig" }, graph)).toContain("Expected nonempty targets");
});

it("resolves exact node paths after runtime IDs change and rejects ambiguous or missing persistent references", () => {
  const { graph } = contract();
  graph.getNode("button-default").id = "renumbered";
  expect(resolveFigmaNode(graph, { path: ["Screens", "state=default"], nodeId: "obsolete" }).id).toBe("renumbered");
  graph.getNode("screen").source = { id: "123:456" };
  expect(resolveFigmaNode(graph, { sourceId: "123:456" }).name).toBe("Home");
  expect(() => resolveFigmaNode(graph, { sourceId: "missing", path: ["Screens", "Home"] })).toThrow(
    "source GUID missing",
  );
  graph.getAllNodes().push({ id: "duplicate", type: "COMPONENT", parentId: "page", name: "state=default" });
  expect(() => resolveFigmaNode(graph, { path: ["Screens", "state=default"] })).toThrow("found 2");
  expect(() => resolveFigmaNode(graph, { nodeId: "screen" })).toThrow("complete page/node name path");
});

it("resolves native public property identifiers and refuses unknown or ambiguous names", () => {
  let actual;
  const instance = {
    componentProperties: { "label#7:1": {}, state: {}, "focusVisible#7:2": {} },
    setProperties: (properties) => {
      actual = properties;
    },
  };
  setComponentProperties(instance, { label: "仲間", state: "hover", focusVisible: true });
  expect(actual).toEqual({ "label#7:1": "仲間", state: "hover", "focusVisible#7:2": true });
  expect(() => setComponentProperties(instance, { missing: true })).toThrow("public Figma property missing");
  instance.componentProperties["label#8:1"] = {};
  expect(() => setComponentProperties(instance, { label: "仲間" })).toThrow("found 2");
});

it("resolves real native scroll frames by unique relative paths without changing geometry", () => {
  const root = { id: "root", type: "INSTANCE", overflowDirection: "NONE" };
  const body = { id: "body", name: "Body", type: "FRAME", parentId: "root" };
  const information = {
    id: "info",
    name: "Information",
    type: "FRAME",
    parentId: "body",
    overflowDirection: "VERTICAL",
    width: 805.1875,
    height: 705.8125,
  };
  const nodes = [root, body, information];
  const graph = { getChildren: (id) => nodes.filter((node) => node.parentId === id) };
  const request = { path: ["Body", "Information"], top: 448 };
  expect(resolveNativeScroll(root, request, graph)).toEqual({ nodeId: "info", top: 448, left: 0 });
  expect(information).toMatchObject({ width: 805.1875, height: 705.8125 });
  expect(() => resolveNativeScroll(root, { ...request, left: 1 }, graph)).toThrow("horizontal scrolling");
  expect(() => resolveNativeScroll(root, { ...request, top: -1 }, graph)).toThrow("nonnegative finite");
  expect(() => resolveNativeScroll(root, { path: ["Missing"] }, graph)).toThrow("found 0");
  nodes.push({ ...information, id: "duplicate" });
  expect(() => resolveNativeScroll(root, request, graph)).toThrow("found 2");
  nodes.pop();
  information.type = "TEXT";
  expect(() => resolveNativeScroll(root, request, graph)).toThrow("FRAME or INSTANCE");
  expect(resolveNativeScroll(root, { path: [] }, graph)).toEqual({ nodeId: "root", top: 0, left: 0 });
});

it("sets only exposed nested instances through unique relative paths and the same public property names", () => {
  let actual;
  const quantity = {
    id: "quantity",
    name: "quantity",
    type: "INSTANCE",
    isExposedInstance: true,
    componentProperties: { "value#7:9": {} },
    setProperties: (properties) => {
      actual = properties;
    },
  };
  const controls = { name: "controls", type: "FRAME", children: [quantity] };
  const root = { id: "root", type: "INSTANCE", children: [controls], exposedInstances: [quantity] };
  const entries = [{ path: ["controls", "quantity"], properties: { value: "4" } }];
  setNestedComponentProperties(root, entries);
  expect(actual).toEqual({ "value#7:9": "4" });
  expect(() => setNestedComponentProperties(root, [{ path: ["missing"], properties: {} }])).toThrow("found 0");
  expect(() => setNestedComponentProperties(root, [{ path: ["controls"], properties: {} }])).toThrow(
    "reference an INSTANCE",
  );
  controls.children.push({ ...quantity, id: "duplicate" });
  expect(() => setNestedComponentProperties(root, entries)).toThrow("found 2");
  controls.children.pop();
  quantity.isExposedInstance = false;
  expect(() => setNestedComponentProperties(root, entries)).toThrow("not publicly exposed");
  quantity.isExposedInstance = true;
  root.exposedInstances = [];
  expect(() => setNestedComponentProperties(root, entries)).toThrow("not publicly exposed");
});

it("rejects malformed, duplicate or frame-based nested property bindings", () => {
  const { graph, manifest } = contract();
  manifest.targets[0].figma.nestedProperties = [{ path: ["quantity"], properties: { value: "4" } }];
  manifest.targets[1].figma.nestedProperties = [
    { path: [], properties: {} },
    { path: ["quantity"], properties: { value: "1" } },
    { path: ["quantity"], properties: { value: "2" } },
  ];
  expect(validateBindings(manifest, graph)).toEqual(
    expect.arrayContaining([
      "Nested Figma properties require a native COMPONENT: home",
      "Invalid nested Figma properties entry: button-default",
      'Duplicate nested Figma properties path: button-default/["quantity"]',
    ]),
  );
  manifest.targets[1].figma.nestedProperties = {};
  expect(validateBindings(manifest, graph)).toContain("Invalid nested Figma properties: button-default");
});

it("shares original asset bytes across exports while keeping relative CSS font URLs valid", async () => {
  const path = await mkdtemp(join(tmpdir(), "design-assets-"));
  temporary.push(path);
  const assets = new Map();
  const picture = Buffer.from([1, 2, 3]);
  const font = Buffer.from([4, 5, 6]);
  for (const index of [1, 2])
    await writeSharedExport(
      {
        data: `<link href="frame.assets/openpencil.css"><img src="frame.assets/images/image-${index}.png">`,
        assets: [
          { path: `frame.assets/images/image-${index}.png`, content: picture },
          { path: "frame.assets/fonts/font.ttf", content: font },
          { path: "frame.assets/openpencil.css", content: '@font-face{src:url("fonts/font.ttf")}' },
        ],
      },
      path,
      `${index}.html`,
      assets,
    );
  const files = await readdir(join(path, "assets"));
  expect(files).toHaveLength(3);
  const html = await readFile(join(path, "1.html"), "utf8");
  expect(html).toBe(await readFile(join(path, "2.html"), "utf8"));
  const image = html.match(/img src="([^"]+)"/)[1];
  expect(await readFile(join(path, image))).toEqual(picture);
  const cssFile = html.match(/href="([^"]+)"/)[1];
  const css = await readFile(join(path, cssFile), "utf8");
  const fontFile = css.match(/url\("([^"]+)"\)/)[1];
  expect(await readFile(join(path, "assets", fontFile))).toEqual(font);
});

it("fails on a single alpha-channel unit and on different dimensions without tolerance or resizing", async () => {
  const path = await mkdtemp(join(tmpdir(), "design-pixels-"));
  temporary.push(path);
  const reference = new PNG({ width: 2, height: 2 });
  reference.data.fill(255);
  const actual = new PNG({ width: 2, height: 2 });
  actual.data.fill(255);
  actual.data[15] = 254;
  await writeFile(join(path, "reference.png"), PNG.sync.write(reference));
  await writeFile(join(path, "actual.png"), PNG.sync.write(actual));
  expect(await comparePNG(join(path, "actual.png"), join(path, "reference.png"))).toMatchObject({
    identical: false,
    totalPixels: 4,
    differentPixels: 1,
    maxChannelDifference: 1,
  });
  await writeFile(join(path, "actual.png"), PNG.sync.write(new PNG({ width: 4, height: 1 })));
  expect(await comparePNG(join(path, "actual.png"), join(path, "reference.png"))).toMatchObject({
    identical: false,
    actualSize: [4, 1],
    referenceSize: [2, 2],
  });
});

it("rejects paint touching the outset edge, even when two clipped pictures would match", async () => {
  const path = await mkdtemp(join(tmpdir(), "design-outset-"));
  temporary.push(path);
  const image = new PNG({ width: 5, height: 5 });
  image.data.fill(0);
  image.data[(2 * 5 + 2) * 4 + 3] = 255;
  const file = join(path, "component.png");
  await writeFile(file, PNG.sync.write(image));
  expect(await clearCaptureBoundary(file, [0, 0, 0, 0])).toMatchObject({ clear: true, differentPixels: 0 });
  image.data[3] = 1;
  await writeFile(file, PNG.sync.write(image));
  expect(await clearCaptureBoundary(file, [0, 0, 0, 0])).toMatchObject({ clear: false, differentPixels: 1 });
});

it("requires an explicit observed caret-on declaration before changing the default hidden capture", () => {
  expect(captureCaret({})).toBe("hide");
  const target = { capture: { caret: "initial" } };
  expect(() => captureCaret(target)).toThrow("explicitly observed on-state");
  target.covers = [{ source: { platform: "text-caret", phase: "off" } }];
  expect(() => captureCaret(target)).toThrow("explicitly observed on-state");
  target.covers[0].source.phase = "on";
  expect(captureCaret(target)).toBe("initial");
  expect(() => captureCaret({ capture: { caret: "sometimes" } })).toThrow("hide or initial");
});

it("plans caret coverage only for a registered same-set instance inside the exported owner", () => {
  const { graph, manifest } = contract(),
    nodes = graph.getAllNodes(),
    target = manifest.targets[0];
  nodes.push({ id: "set", name: "Caret", type: "COMPONENT_SET", parentId: "page" });
  for (const [index, state] of ["default", "hover"].entries()) {
    graph.getNode(`button-${state}`).parentId = "set";
    const reference = { path: ["Screens", "Caret", `state=${state}`] };
    manifest.components[0].nodes[index] = reference;
    manifest.targets[index + 1].figma = structuredClone(reference);
  }
  nodes.push({
    id: "caret-instance",
    name: "Insertion caret",
    type: "INSTANCE",
    parentId: "page",
    componentId: "button-default",
  });
  target.figma.animationTime = 500;
  target.capture = { animations: "allow" };
  const cover = {
    component: "button",
    state: "default",
    figma: {
      instance: { path: ["Screens", "Insertion caret"] },
      main: { path: ["Screens", "Caret", "state=default"] },
      properties: {},
    },
    source: { selector: "input", platform: "text-caret", phase: "off", empty: false },
  };
  target.covers = [cover];
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("outside the exported owner");
  graph.getNode("caret-instance").parentId = "screen";
  cover.figma.instance.path = ["Screens", "Home", "Insertion caret"];
  const resolved = resolveCompositeComponent(graph, target, cover);
  expect(resolveCompositeClone(graph, graph.getNode("screen"), resolved).id).toBe("caret-instance");
  manifest.targets.splice(1, 1);
  expect(validateBindings(manifest, graph)).toEqual([]);
  expect(() => assertCompositeCoverage(target, [], [], { identical: true, differentPixels: 0 })).toThrow(
    "complete source and native observation",
  );
  cover.state = "absent";
  expect(validateBindings(manifest, graph)).toContain(
    "home: Covered state is not an inventoried implemented component state",
  );
  cover.state = "default";
  const normalMain = graph.getMainComponent;
  graph.getNode("caret-instance").componentId = "saved-source-instance";
  graph.getMainComponent = (id) => (id === "caret-instance" ? graph.getNode("button-default") : normalMain(id));
  expect(resolveCompositeComponent(graph, target, cover).entry.id).toBe("button-default");
  graph.getMainComponent = normalMain;
  graph.getNode("caret-instance").componentId = "screen";
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("same-set prototype");
  cover.source.platform = "select-popup";
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("supported phase");
});

it("checks every actual nonvariant public value instead of accepting a declared component's presence", () => {
  const { graph } = contract(),
    instance = { id: "placed" },
    main = { id: "button-default", componentPropertyValues: { state: "hover" } };
  const properties = {
    "label#2": { type: "TEXT", value: "装備なし" },
    "disabled#3": { type: "BOOLEAN", value: false },
    state: { type: "VARIANT", value: "default" },
  };
  const api = {
    wrapNode: (id) =>
      id === instance.id ? { componentProperties: properties } : { variantProperties: { state: "hover" } },
  };
  expect(
    observeCompositeProperties(api, graph, instance, main, { label: "装備なし", disabled: false, state: "hover" }),
  ).toEqual({
    label: { type: "TEXT", value: "装備なし" },
    disabled: { type: "BOOLEAN", value: false },
    state: { type: "VARIANT", value: "hover" },
  });
  expect(() => observeCompositeProperties(api, graph, instance, main, { label: "装備なし" })).toThrow(
    "Missing covered public property",
  );
  expect(() => observeCompositeProperties(api, graph, instance, main, { label: "別の値", disabled: false })).toThrow(
    "differs: label",
  );
  properties["label#4"] = { type: "TEXT", value: "装備なし" };
  expect(() => observeCompositeProperties(api, graph, instance, main, { label: "装備なし", disabled: false })).toThrow(
    "found 2",
  );
});

it("reads the measured UA caret phase without changing or masking any pixel", () => {
  const image = new PNG({ width: 5, height: 5 }),
    clip = { x: 10, y: 20, width: 5, height: 5 };
  const rectangle = { x: 12, y: 21, width: 1, height: 3 },
    color = [62, 51, 38, 255];
  const before = Buffer.from(image.data);
  const off = observeCaretBitmap(PNG.sync.write(image), clip, rectangle, color, "off");
  expect(off.visible).toBe(false);
  expect(image.data).toEqual(before);
  expect(() => observeCaretBitmap(PNG.sync.write(image), clip, rectangle, color, "on")).toThrow(
    "differs from its declared phase",
  );
  color.forEach((value, channel) => {
    image.data[(1 * image.width + 2) * 4 + channel] = value;
  });
  expect(() => observeCaretBitmap(PNG.sync.write(image), clip, rectangle, color, "off")).toThrow(
    "differs from its declared phase",
  );
  image.data.fill(0);
  for (let y = 1; y < 4; y++)
    color.forEach((value, channel) => {
      image.data[(y * 5 + 2) * 4 + channel] = value;
    });
  const bytes = PNG.sync.write(image),
    original = Buffer.from(bytes);
  expect(observeCaretBitmap(bytes, clip, rectangle, color, "on").matchingPixels).toBe(3);
  expect(bytes).toEqual(original);
  expect(() => observeCaretBitmap(bytes, clip, rectangle, color, "off")).toThrow("differs from its declared phase");
  expect(() => observeCaretBitmap(bytes, clip, { ...rectangle, x: 12.5 }, color, "on")).toThrow("integer UA bar");
  expect(() => assertPaintContained({ ...rectangle, height: 5 }, clip)).toThrow("fully inside");
  expect(() => assertPaintContained({ ...rectangle, y: 19.999999999 }, clip)).toThrow("fully inside");
});

function compositeObservation() {
  const cover = {
    component: "caret",
    state: "off",
    source: { platform: "text-caret", selector: "input", phase: "off", empty: false },
  };
  const target = {
    covers: [cover],
    figma: { animationTime: 500 },
    capture: { animations: "allow" },
  };
  const saved = {
    component: cover.component,
    state: cover.state,
    nodeId: "placed",
    ownerNodeId: "screen",
    mainId: "end",
    entryMainId: "start",
    instanceId: "saved",
    properties: { label: { type: "TEXT", value: "one" } },
  };
  const source = {
    selector: cover.source.selector,
    platform: "text-caret",
    connected: true,
    control: "input",
    focused: true,
    disabled: false,
    readOnly: false,
    value: "0",
    caretColor: [62, 51, 38, 255],
    policy: "hide",
    caret: { reasonIds: ["Caret"], rectangle: { x: 4, y: 4, width: 1, height: 3 } },
  };
  const native = {
    nodeId: saved.nodeId,
    ownerNodeId: saved.ownerNodeId,
    connected: true,
    visible: true,
    belongsToOwner: true,
    properties: saved.properties,
    paint: [{ x: 2, y: 2, width: 6, height: 6 }],
  };
  const { observation } = animationDestination(500);
  observation.animations[0].targetNodeId = "bar";
  observation.programs[0].ownerNodeId = saved.nodeId;
  observation.programs[0].endpoints[1].at = 500;
  observation.programs[0].segments[0].end = 500;
  native.animation = observation;
  native.caret = [{ nodeId: "bar", ownerNodeId: saved.nodeId, rectangle: structuredClone(source.caret.rectangle) }];
  const proof = {
    component: cover.component,
    state: cover.state,
    nodeId: saved.nodeId,
    mainId: saved.mainId,
    clip: { x: 0, y: 0, width: 10, height: 10 },
    source: {
      before: source,
      after: structuredClone(source),
      bitmap: {
        rectangle: source.caret.rectangle,
        color: source.caretColor,
        visible: false,
        matchingPixels: 0,
        totalPixels: 3,
      },
    },
    native: { before: native, after: structuredClone(native) },
  };
  return { target, saved, proof, comparison: { identical: true, differentPixels: 0 } };
}

it("never completes composite coverage from presence alone, clipped paint or a nonzero enclosing comparison", () => {
  const { target, saved, proof, comparison } = compositeObservation();
  expect(assertCompositeCoverage(target, [saved], [proof], comparison)).toEqual([
    { component: "caret", state: "off", mainId: "end", instanceId: "saved" },
  ]);
  for (const observations of [undefined, [], [{ component: "caret", state: "off", nodeId: "placed", mainId: "end" }]])
    expect(() => assertCompositeCoverage(target, [saved], observations, comparison)).toThrow();
  for (const changed of [undefined, { identical: false, differentPixels: 1 }, { identical: true, differentPixels: 1 }])
    expect(() => assertCompositeCoverage(target, [saved], [proof], changed)).toThrow("enclosing all-RGBA");
  for (const field of ["connected", "visible", "belongsToOwner"]) {
    const changed = structuredClone(proof);
    changed.native.before[field] = changed.native.after[field] = false;
    expect(() => assertCompositeCoverage(target, [saved], [changed], comparison)).toThrow();
  }
  const clipped = structuredClone(proof);
  clipped.native.before.paint[0].x = clipped.native.after.paint[0].x = -0.00000001;
  expect(() => assertCompositeCoverage(target, [saved], [clipped], comparison)).toThrow("fully inside");
  const wrongProperties = structuredClone(proof);
  wrongProperties.native.before.properties.label.value = wrongProperties.native.after.properties.label.value = "two";
  expect(() => assertCompositeCoverage(target, [saved], [wrongProperties], comparison)).toThrow("owner/properties");
  const blurred = structuredClone(proof);
  blurred.source.before.focused = blurred.source.after.focused = false;
  expect(() => assertCompositeCoverage(target, [saved], [blurred], comparison)).toThrow("focused editable");
});

it("requires actual editable caret state, source bitmap phase and the registered native clock endpoint together", () => {
  const { target, saved, proof, comparison } = compositeObservation();
  expect(assertCompositeCoverage(target, [saved], [proof], comparison)).toHaveLength(1);
  for (const changes of [
    { focused: false },
    { disabled: true },
    { readOnly: true },
    { caret: undefined },
    { policy: "initial" },
    { value: "" },
  ])
    expect(() => assertSourcePlatformPhase(target.covers[0].source, { ...proof.source.before, ...changes })).toThrow(
      "focused editable",
    );
  const selected = structuredClone(proof);
  selected.source.before.caret.reasonIds = selected.source.after.caret.reasonIds = [];
  expect(() => assertCompositeCoverage(target, [saved], [selected], comparison)).toThrow("Caret layer");
  const wrongBitmap = structuredClone(proof);
  wrongBitmap.source.bitmap.visible = true;
  expect(() => assertCompositeCoverage(target, [saved], [wrongBitmap], comparison)).toThrow(
    "actual source bitmap phase",
  );
  const partialOff = structuredClone(proof);
  partialOff.source.bitmap.matchingPixels = 1;
  expect(() => assertCompositeCoverage(target, [saved], [partialOff], comparison)).toThrow(
    "actual source bitmap phase",
  );
  for (const shift of [undefined, 1]) {
    const incorrect = structuredClone(proof);
    incorrect.native.before.caret = incorrect.native.after.caret =
      shift === undefined
        ? []
        : [
            {
              ...incorrect.native.before.caret[0],
              rectangle: { ...proof.source.before.caret.rectangle, y: proof.source.before.caret.rectangle.y + shift },
            },
          ];
    expect(() => assertCompositeCoverage(target, [saved], [incorrect], comparison)).toThrow("physical paint bounds");
  }
  const wrongLayer = structuredClone(proof);
  wrongLayer.native.before.caret[0].nodeId = wrongLayer.native.after.caret[0].nodeId = "unrelated-bar";
  expect(() => assertCompositeCoverage(target, [saved], [wrongLayer], comparison)).toThrow("animation target");
  const wrongOwner = structuredClone(proof);
  wrongOwner.native.before.animation.programs[0].ownerNodeId =
    wrongOwner.native.after.animation.programs[0].ownerNodeId = "other";
  expect(() => assertCompositeCoverage(target, [saved], [wrongOwner], comparison)).toThrow(
    "unambiguous exported owner",
  );
  const wrongEndpoint = structuredClone(proof);
  wrongEndpoint.native.before.animation.programs[0].variantId =
    wrongEndpoint.native.after.animation.programs[0].variantId = "start";
  expect(() => assertCompositeCoverage(target, [saved], [wrongEndpoint], comparison)).toThrow("not reached");
});

function popupContract() {
  const { graph, manifest } = contract(),
    nodes = graph.getAllNodes(),
    target = manifest.targets[0];
  const mapping = Array.from({ length: 3 }, (_, index) =>
    Object.fromEntries(
      ["label", "visible", "disabled", "highlighted"].map((role) => [role, `options/${index}/${role}`]),
    ),
  );
  const values = Object.fromEntries(
    mapping.flatMap((row, index) =>
      Object.entries(row).map(([role, name]) => [
        name,
        role === "label"
          ? ["None", "One", "Two"][index]
          : role === "visible"
            ? true
            : role === "highlighted"
              ? index === 1
              : false,
      ]),
    ),
  );
  const definitions = Object.entries(values).map(([name, value], index) => ({
    id: `property-${index}`,
    name,
    type: typeof value === "string" ? "TEXT" : "BOOLEAN",
    defaultValue: String(value),
  }));
  nodes.push({
    id: "popup-main",
    name: "Popup",
    type: "COMPONENT",
    parentId: "page",
    componentPropertyDefinitions: definitions,
  });
  for (const definition of definitions)
    nodes.push({
      id: `${definition.id}-content`,
      name: definition.name,
      type: definition.type === "TEXT" ? "TEXT" : "FRAME",
      parentId: "popup-main",
      componentPropertyReferences: [
        { propertyId: definition.id, field: definition.type === "TEXT" ? "TEXT" : "VISIBLE" },
      ],
    });
  nodes.push({ id: "overlay-frame", name: "Destination", type: "FRAME", parentId: "page" });
  nodes.push({
    id: "popup-instance",
    name: "Popup instance",
    type: "INSTANCE",
    parentId: "overlay-frame",
    componentId: "popup-main",
  });
  const reaction = {
    trigger: { type: "ON_CLICK" },
    actions: [{ type: "NODE", navigation: "OVERLAY", destinationId: "overlay-frame", transition: null }],
  };
  nodes.push({
    id: "trigger",
    name: "Select",
    type: "INSTANCE",
    parentId: "screen",
    componentId: "button-default",
    reactions: [reaction],
  });
  const cover = {
    component: "popup",
    state: "next",
    figma: {
      main: { path: ["Screens", "Popup"] },
      instance: { path: ["Screens", "Destination", "Popup instance"] },
      properties: values,
    },
    source: {
      selector: "select",
      platform: "select-popup",
      phase: "open",
      highlightedIndex: 1,
      optionProperties: mapping,
    },
  };
  target.figma.interactions = [{ type: "click", node: { path: ["Screens", "Home", "Select"] } }];
  target.covers = [cover];
  manifest.components.push({
    id: "popup",
    source: "src/Select.svelte",
    nodes: [cover.figma.main],
    requiredStates: ["next"],
  });
  return { graph, manifest, target, cover, reaction };
}

it("covers only a bound static Popup instance reached by one explicit saved overlay click", () => {
  const { graph, manifest, target, cover, reaction } = popupContract();
  const resolved = resolveCompositeComponent(graph, target, cover);
  expect(resolved.overlay).toEqual({ destinationId: "overlay-frame", triggerSourceId: "trigger" });
  expect(resolveCompositeClone(graph, graph.getNode("screen"), resolved).id).toBe("popup-instance");
  expect(validateBindings(manifest, graph)).toEqual([]);
  target.figma.interactions = [];
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("one declared saved click");
  target.figma.interactions = [{ type: "click", node: { path: ["Screens", "Home", "Select"] } }];
  reaction.actions[0].destinationId = "screen";
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("one declared saved click");
  reaction.actions[0].destinationId = "overlay-frame";
  graph.getNode("trigger").reactions.push(structuredClone(reaction));
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("one declared saved click");
  graph.getNode("trigger").reactions.pop();
  graph.getNode("popup-instance").componentId = "button-default";
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("exact saved static");
});

it("rejects public popup props that are unbound, duplicate or not ordinary typed option content", () => {
  const { graph, target, cover } = popupContract();
  graph.getNode("property-0-content").componentPropertyReferences = [];
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("bind real ordinary option content");
  graph.getNode("property-0-content").componentPropertyReferences = [{ propertyId: "property-0", field: "TEXT" }];
  cover.source.optionProperties[0].disabled = cover.source.optionProperties[0].visible;
  expect(() => resolveCompositeComponent(graph, target, cover)).toThrow("distinct typed");
});

function popupPixels() {
  const image = new PNG({ width: 60, height: 50 }),
    rectangle = { x: 20, y: 20, width: 20, height: 8 };
  const put = (x, y, color) =>
    color.forEach((value, channel) => {
      image.data[(y * image.width + x) * 4 + channel] = value;
    });
  for (let y = 20; y < 28; y++)
    for (let x = 20; x < 40; x++)
      put(
        x,
        y,
        x === 20 || x === 39 || y === 20 || y === 27
          ? [133, 133, 133, 255]
          : y === 23 || y === 24
            ? [153, 200, 255, 255]
            : [16, 23, 19, 255],
      );
  const source = {
    selector: "select",
    platform: "select-popup",
    control: "select",
    connected: true,
    focused: true,
    disabled: false,
    open: true,
    multiple: false,
    size: 0,
    colorScheme: "dark",
    plainOptions: true,
    value: "",
    selectedIndex: 0,
    bounds: { x: 20, y: 10, width: 20, height: 10 },
    background: [16, 23, 19, 255],
    options: ["None", "One", "Two"].map((label, index) => ({ label, value: String(index), disabled: false })),
  };
  return { image, rectangle, source, clip: { x: 0, y: 0, width: 60, height: 50 }, put };
}

it("observes the complete original native window and highlight without modifying its bitmap", () => {
  const { image, clip, source, rectangle, put } = popupPixels(),
    bytes = PNG.sync.write(image),
    before = Buffer.from(bytes);
  expect(observeSelectPopupBitmap(bytes, clip, source, 1)).toMatchObject({
    rectangle,
    completeBorder: true,
    rowHeight: 2,
    highlightedIndex: 1,
  });
  expect(bytes).toEqual(before);
  expect(() => observeSelectPopupBitmap(bytes, clip, source, 0)).toThrow("highlighted row");
  put(20, 21, [0, 0, 0, 0]);
  expect(() => observeSelectPopupBitmap(PNG.sync.write(image), clip, source, 1)).toThrow("complete native border");
  expect(() => observeSelectPopupBitmap(bytes, { ...clip, width: 59 }, source, 1)).toThrow("unchanged comparison crop");
});

it("distinguishes a popup from a connected control border by every actual option row", () => {
  const { image, clip, source, rectangle, put } = popupPixels();
  for (let y = 14; y < 20; y++)
    for (let x = 20; x < 40; x++)
      put(x, y, x === 20 || x === 39 || y === 14 ? [133, 133, 133, 255] : source.background);
  const bytes = PNG.sync.write(image),
    before = Buffer.from(bytes);
  expect(observeSelectPopupBitmap(bytes, clip, source, 1)).toMatchObject({ rectangle, rowHeight: 2 });
  expect(bytes).toEqual(before);
});

it("rejects multiple complete windows that both match all actual option rows", () => {
  const { image, clip, source, put } = popupPixels();
  for (let y = 20; y < 28; y++)
    for (let x = 20; x < 40; x++) {
      const offset = (y * image.width + x) * 4;
      put(x, y + 12, [...image.data.subarray(offset, offset + 4)]);
    }
  expect(() => observeSelectPopupBitmap(PNG.sync.write(image), clip, source, 1)).toThrow(
    "one complete native border; found 2",
  );
});

function popupObservation() {
  const { target, cover } = popupContract(),
    { image, source, clip, rectangle } = popupPixels();
  const bitmap = observeSelectPopupBitmap(PNG.sync.write(image), clip, source, 1);
  const properties = Object.fromEntries(
    Object.entries(cover.figma.properties).map(([name, value]) => [
      name,
      { type: typeof value === "string" ? "TEXT" : "BOOLEAN", value },
    ]),
  );
  const saved = {
    component: "popup",
    state: "next",
    nodeId: "popup-instance",
    instanceId: "popup-instance",
    ownerNodeId: "screen",
    mainId: "popup-main",
    entryMainId: "popup-main",
    properties,
    overlay: { destinationId: "overlay-frame", triggerNodeId: "trigger" },
  };
  const pose = {
    nodeId: saved.nodeId,
    ownerNodeId: saved.ownerNodeId,
    connected: true,
    visible: true,
    belongsToOwner: true,
    properties,
    paint: [rectangle],
    bounds: rectangle,
    overlay: { ...saved.overlay, open: true, trusted: true, activationCount: 1, mainId: saved.mainId },
  };
  const proof = {
    component: "popup",
    state: "next",
    mainId: saved.mainId,
    nodeId: saved.nodeId,
    clip,
    source: {
      before: source,
      after: structuredClone(source),
      bitmaps: { before: bitmap, capture: structuredClone(bitmap), after: structuredClone(bitmap) },
    },
    native: { before: pose, after: structuredClone(pose) },
  };
  return { target, cover, saved, proof, comparison: { identical: true, differentPixels: 0 } };
}

it("matches every actual popup option and rejects a missing or unopened platform state", () => {
  const { cover, saved, proof } = popupObservation();
  assertSourcePlatformPhase(cover.source, proof.source.before);
  assertSelectPopupProperties(cover.source, proof.source.before, saved.properties);
  for (const changes of [
    { open: false },
    { disabled: true },
    { multiple: true },
    { size: 2 },
    { plainOptions: false },
    { colorScheme: "light" },
  ])
    expect(() => assertSourcePlatformPhase(cover.source, { ...proof.source.before, ...changes })).toThrow(
      "open plain single-select",
    );
  const wrong = structuredClone(saved.properties);
  wrong["options/1/label"].value = "Wrong";
  expect(() => assertSelectPopupProperties(cover.source, proof.source.before, wrong)).toThrow("actual source option");
  const one = structuredClone(proof.source.before);
  one.options.length = 1;
  expect(() => assertSelectPopupProperties(cover.source, one, saved.properties)).toThrow("actual source option");
});

it("requires actual overlay activation and the full observed Popup window plus all-RGBA zero", () => {
  const { target, saved, proof, comparison } = popupObservation();
  expect(assertCompositeCoverage(target, [saved], [proof], comparison)).toHaveLength(1);
  for (const field of ["open", "trusted"]) {
    const changed = structuredClone(proof);
    changed.native.before.overlay[field] = changed.native.after.overlay[field] = false;
    expect(() => assertCompositeCoverage(target, [saved], [changed], comparison)).toThrow("actual saved overlay");
  }
  for (const patch of [
    { destinationId: "other" },
    { triggerNodeId: "other" },
    { activationCount: 0 },
    { activationCount: 2 },
    { mainId: "other" },
  ]) {
    const changed = structuredClone(proof);
    Object.assign(changed.native.before.overlay, patch);
    Object.assign(changed.native.after.overlay, patch);
    expect(() => assertCompositeCoverage(target, [saved], [changed], comparison)).toThrow("actual saved overlay");
  }
  const partial = structuredClone(proof);
  partial.source.bitmaps.capture.completeBorder = false;
  expect(() => assertCompositeCoverage(target, [saved], [partial], comparison)).toThrow("complete source window");
  const shifted = structuredClone(proof);
  shifted.native.before.bounds.x++;
  shifted.native.after.bounds.x++;
  expect(() => assertCompositeCoverage(target, [saved], [shifted], comparison)).toThrow("full window bounds");
  expect(() => assertCompositeCoverage(target, [saved], [proof], { identical: false, differentPixels: 1 })).toThrow(
    "enclosing all-RGBA",
  );
  target.interaction = { type: "pointer", selector: "select", position: { x: 2, y: 13 } };
  expect(() => assertCompositeCoverage(target, [saved], [proof], comparison)).toThrow("receiving platform window");
  proof.source.pointer = {
    origin: { x: 10, y: 20 },
    point: { x: 35, y: 43 },
    window: { x: 30, y: 40, width: 20, height: 8 },
  };
  expect(assertCompositeCoverage(target, [saved], [proof], comparison)).toHaveLength(1);
  proof.source.pointer.point.y = 41;
  expect(() => assertCompositeCoverage(target, [saved], [proof], comparison)).toThrow("requested row");
});
