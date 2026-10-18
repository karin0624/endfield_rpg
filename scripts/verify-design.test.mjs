import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { afterEach, expect, it } from "vitest";
import { comparePNG } from "./compare-png.mjs";
import { exportDesignAssets } from "./export-design-assets.mjs";
import {
  assertDesignBrowserScreen,
  assertPressedCapture,
  captureGeometry,
  clearCaptureBoundary,
  cropPNG,
  resolveFigmaNode,
  resolveNativeInteractions,
  setComponentProperties,
  setNestedComponentProperties,
  validateBindings,
  writeSharedExport,
} from "./verify-design-bindings.mjs";

const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
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
  ).toEqual({ clip: { x: 99, y: 420, width: 416, height: 156 } });
  expect(captureGeometry({ x: 32.25, y: 64.75, width: 272.5, height: 88.25 }, 16)).toEqual({
    clip: { x: 16, y: 48, width: 305, height: 121 },
  });
  expect(captureGeometry({ x: -0.25, y: -0.5, width: 10.5, height: 11.25 }, 0)).toEqual({
    clip: { x: -1, y: -1, width: 12, height: 12 },
  });
  expect(captureGeometry({ x: 323.4296875, y: 22.1015625, width: 87.515625, height: 19.5 }, 16)).toEqual({
    clip: { x: 307, y: 6, width: 120, height: 52 },
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

it("rejects assets as direct comparison targets", () => {
  const { graph, manifest } = contract();
  addArtwork(manifest, graph);
  const target = structuredClone(manifest.targets[1]);
  Object.assign(target, { id: "asset-target", component: "artwork", figma: { path: ["Screens", "Artwork"] } });
  manifest.targets.push(target);
  expect(validateBindings(manifest, graph)).toContain("Design assets must not be comparison targets: asset-target");
  target.kind = "screen";
  expect(validateBindings(manifest, graph)).toContain("Design assets must not be comparison targets: asset-target");
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
    { type: "key", key: "ControlOrMeta+A", selector: "input", expectedValue: "42" },
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

it("keeps button release and the uncommitted popup value explicit native interactions", () => {
  const { graph, manifest } = contract();
  manifest.targets[1].interaction = [
    { type: "pressed", selector: "select" },
    { type: "release", selector: "select" },
    { type: "key", selector: "select", key: "ArrowDown", expectedValue: "original" },
  ];
  expect(validateBindings(manifest, graph)).toEqual([]);
  manifest.targets[1].interaction[2].expectedValue = 42;
  expect(validateBindings(manifest, graph)).toContain("Invalid native interaction: button-default");
});

it("validates a relative press and its final value without allowing keyboard presses or intermediate expectations", () => {
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
  expect(await clearCaptureBoundary(file, [0, 0, 0, 0], 0)).toMatchObject({ clear: true, differentPixels: 0 });
});
