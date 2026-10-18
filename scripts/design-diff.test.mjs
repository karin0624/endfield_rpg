import { describe, expect, it } from "vitest";
import { compareDesignSnapshots, createDesignSnapshot, designInputHash } from "./design-diff.mjs";

// The shape is the public parseFigFile SceneGraph, including imported source GUIDs.
function document() {
  const nodes = new Map();
  function add(id, type, parentId, fields = {}) {
    const node = {
      id,
      type,
      name: id,
      source: { id: `guid/${id}`, editedFields: [] },
      parentId,
      childIds: [],
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      visible: true,
      fills: [],
      boundVariables: {},
      variableModes: {},
      ...fields,
    };
    nodes.set(id, node);
    if (parentId) nodes.get(parentId).childIds.push(id);
    return node;
  }
  add("page", "CANVAS", null);
  add("buttons", "COMPONENT_SET", "page");
  add("default", "COMPONENT", "buttons", {
    name: "state=default",
    x: 100,
    y: 100,
    fills: [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0, a: 1 } }],
    boundVariables: { fill: "button-fill" },
  });
  add("label", "TEXT", "default", { text: "決定", fontFamily: "Game Serif", fontWeight: 600 });
  add("icon", "RECTANGLE", "default", { fills: [{ type: "IMAGE", imageHash: "icon" }] });
  add("hover", "COMPONENT", "buttons", { name: "state=hover", fills: [{ type: "SOLID", color: "gold" }] });
  add("screen", "FRAME", "page", { x: 1000, width: 1920, height: 1080 });
  add("button-instance", "INSTANCE", "screen", { componentId: "default", x: 700, y: 800 });
  add("instance-label", "TEXT", "button-instance", { text: "決定", fontFamily: "Game Serif", fontWeight: 600 });
  add("style", "TEXT", "page", { sharedStyleType: "TEXT", fontFamily: "Game Serif", fontSize: 16 });
  const graph = {
    nodes,
    variables: new Map([
      [
        "button-fill",
        { type: "COLOR", name: "button-fill", collectionId: "colors", valuesByMode: { light: { aliasId: "gold" } } },
      ],
      ["gold", { type: "COLOR", name: "gold", collectionId: "colors", valuesByMode: { light: "#ccaa44" } }],
      ["unused", { type: "COLOR", name: "unused", collectionId: "colors", valuesByMode: { light: "#ffffff" } }],
    ]),
    variableCollections: new Map([
      [
        "colors",
        {
          id: "colors",
          name: "Colors",
          defaultModeId: "light",
          modes: [{ modeId: "light", name: "Light" }],
          variableIds: ["button-fill", "gold", "unused"],
        },
      ],
    ]),
    images: new Map([["icon", new Uint8Array([1, 2, 3])]]),
    activeMode: new Map([["colors", "light"]]),
    documentColorSpace: "srgb",
    getAllNodes: () => [...nodes.values()],
    getNode: (id) => nodes.get(id),
    getPages: () => [nodes.get("page")],
    getChildren: (id) => nodes.get(id).childIds.map((child) => nodes.get(child)),
  };
  const manifest = {
    document: "design.fig",
    targets: [
      {
        id: "button/default",
        kind: "component",
        source: "Button.svelte",
        figma: { sourceId: "guid/default" },
        viewport: { width: 400, height: 300 },
      },
      {
        id: "button/hover",
        kind: "component",
        source: "Button.svelte",
        figma: { sourceId: "guid/hover" },
        viewport: { width: 400, height: 300 },
      },
      {
        id: "screen",
        kind: "screen",
        source: "Screen.svelte",
        figma: { sourceId: "guid/screen" },
        viewport: { width: 1920, height: 1080 },
      },
    ],
  };
  return { graph, manifest, add };
}

function snapshot(doc, options) {
  return createDesignSnapshot(doc.graph, doc.manifest, options);
}

function sourceLessDocument() {
  const doc = document();
  for (const id of ["default", "hover", "label", "icon", "button-instance", "instance-label"])
    doc.graph.getNode(id).source.id = null;
  doc.graph.getNode("buttons").componentPropertyDefinitions = [
    { id: "state-prop", name: "state", type: "VARIANT", defaultValue: "default", variantOptions: ["default", "hover"] },
  ];
  doc.graph.getNode("default").componentPropertyValues = { state: "default" };
  doc.graph.getNode("hover").componentPropertyValues = { state: "hover" };
  doc.manifest.targets[0].figma = { path: ["page", "buttons", "state=default"] };
  doc.manifest.targets[1].figma = { path: ["page", "buttons", "state=hover"] };
  return doc;
}

// Model a fresh document import: handles change, file GUIDs and user text do not.
function renumberNodes(doc) {
  const original = [...doc.graph.nodes.values()];
  const ids = new Map(original.map((node) => [node.id, `new/${node.id}`]));
  const types = new Map(
    original.flatMap((node) =>
      (node.componentPropertyDefinitions ?? []).map((definition) => [definition.id, definition.type]),
    ),
  );
  doc.graph.nodes.clear();
  for (const node of original) {
    node.id = ids.get(node.id);
    node.parentId = ids.get(node.parentId) ?? node.parentId;
    node.childIds = node.childIds.map((id) => ids.get(id));
    if (node.componentId) node.componentId = ids.get(node.componentId);
    for (const reaction of node.reactions ?? [])
      for (const action of reaction.actions) action.destinationId = ids.get(action.destinationId);
    for (const definition of node.componentPropertyDefinitions ?? []) {
      if (definition.type === "INSTANCE_SWAP")
        definition.defaultValue = ids.get(definition.defaultValue) ?? definition.defaultValue;
      if (["INSTANCE_SWAP", "SLOT"].includes(definition.type) && definition.preferredValues)
        definition.preferredValues = definition.preferredValues.map((id) => ids.get(id) ?? id);
    }
    for (const [property, value] of Object.entries(node.componentPropertyAssignments ?? {}))
      if (types.get(property) === "INSTANCE_SWAP")
        node.componentPropertyAssignments[property] = ids.get(value) ?? value;
    if (node.instanceOverrides) {
      node.instanceOverrides.descendants = new Map(
        [...node.instanceOverrides.descendants].map(([id, fields]) => [ids.get(id), fields]),
      );
      for (const fields of [node.instanceOverrides.self, ...node.instanceOverrides.descendants.values()])
        for (const [field, value] of fields)
          if (["componentId", "sourceComponentId"].includes(field)) fields.set(field, ids.get(value));
    }
    doc.graph.nodes.set(node.id, node);
  }
  doc.graph.getPages = () => [...doc.graph.nodes.values()].filter((node) => node.type === "CANVAS");
  return ids;
}

describe("design dependency selection", () => {
  it("selects all cases without a compatible signature and none for an unchanged parsed document", () => {
    const first = snapshot(document());
    expect(compareDesignSnapshots(undefined, first).selected).toEqual(["button/default", "button/hover", "screen"]);
    expect(compareDesignSnapshots(first, snapshot(document()))).toMatchObject({ selected: [], removed: [] });
    expect(compareDesignSnapshots({ version: 0, targets: {} }, first).reasons.screen).toContain(
      "no-compatible-snapshot",
    );
    expect(() => compareDesignSnapshots(first, { version: 0, targets: {} })).toThrow("Unsupported current");
  });

  it("ignores canvas organization and editing metadata, but tracks child placement in its parent", () => {
    const doc = document();
    const before = snapshot(doc);
    Object.assign(doc.graph.getNode("default"), {
      x: 1234,
      y: -12,
      name: "Renamed button",
      expanded: false,
      locked: true,
    });
    Object.assign(doc.graph.getNode("buttons"), { x: 5000, y: 32 });
    doc.graph.getNode("default").source.editedFields = ["x", "y"];
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
    doc.graph.getNode("button-instance").x += 1;
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["screen"]);
  });

  it("rechecks all cases when the pinned exporter revision changes", () => {
    const doc = document();
    const before = snapshot(doc, { environment: { image: "fixed-image", openpencilRevision: "revision-a" } });
    const after = snapshot(doc, { environment: { image: "fixed-image", openpencilRevision: "revision-b" } });
    expect(compareDesignSnapshots(before, after)).toMatchObject({
      selected: ["button/default", "button/hover", "screen"],
      referenceChanged: ["button/default", "button/hover", "screen"],
      implementationChanged: ["button/default", "button/hover", "screen"],
    });
  });

  it("rechecks the reference when its shared Story frame changes", () => {
    const doc = document();
    doc.manifest.targets[0].renderFrame = { padding: 32 };
    const before = snapshot(doc);
    doc.manifest.targets[0].renderFrame.padding = 64;
    expect(compareDesignSnapshots(before, snapshot(doc))).toMatchObject({
      selected: ["button/default"],
      referenceChanged: ["button/default"],
      implementationChanged: [],
    });
  });

  it("does not include temporary export instances or their deletion in the master signature", () => {
    const doc = document();
    const before = snapshot(doc);
    doc.add("export-wrapper", "FRAME", "page", {
      source: { id: null },
      fills: [{ type: "SOLID", color: "black" }],
      x: 500,
    });
    doc.add("export-instance", "INSTANCE", "export-wrapper", {
      source: { id: null },
      componentId: "default",
    });
    doc.add("export-label", "TEXT", "export-instance", {
      source: { id: null },
      text: "Export override",
      fontFamily: "Different Font",
    });
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
    for (const id of ["export-wrapper", "export-instance", "export-label"]) doc.graph.nodes.delete(id);
    doc.graph.getNode("page").childIds = doc.graph.getNode("page").childIds.filter((id) => id !== "export-wrapper");
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
  });

  it("propagates a main component paint change to its instances without selecting unrelated variants", () => {
    const doc = document();
    const before = snapshot(doc);
    doc.graph.getNode("default").fills[0].color.r = 0.9;
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "screen"]);
    expect(snapshot(doc).targets.screen.dependencies.nodes).toContain("guid/default");
  });

  it("includes the variants selected by public root and nested component properties", () => {
    const doc = document();
    doc.graph.getMainComponent = () => doc.graph.getNode("default");
    doc.graph.getNode("buttons").componentPropertyDefinitions = [
      {
        id: "state-property",
        name: "state",
        type: "VARIANT",
        defaultValue: "default",
        variantOptions: ["default", "hover"],
      },
    ];
    doc.graph.getNode("default").componentPropertyValues = { state: "default" };
    doc.graph.getNode("hover").componentPropertyValues = { state: "hover" };
    doc.manifest.targets[0].figma.properties = { state: "hover" };
    doc.manifest.targets[2].figma.nestedProperties = [{ path: ["button-instance"], properties: { state: "hover" } }];
    const before = snapshot(doc);
    doc.graph.getNode("hover").fills[0].color = "red";
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual([
      "button/default",
      "button/hover",
      "screen",
    ]);
  });

  it("keeps geometry and child z-order as render inputs", () => {
    const doc = document();
    const before = snapshot(doc);
    doc.graph.getNode("default").childIds.reverse();
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual(["button/default", "screen"]);
    doc.graph.getNode("default").childIds.reverse();
    doc.graph.getNode("label").x = 0.5;
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual(["button/default", "screen"]);
  });

  it("follows variable aliases, without invalidating users of an unrelated token in the same collection", () => {
    const doc = document();
    const before = snapshot(doc);
    doc.graph.variables.get("unused").valuesByMode.light = "#000000";
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
    doc.graph.variables.get("gold").valuesByMode.light = "#aaaa00";
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "screen"]);
    expect(snapshot(doc).targets.screen.dependencies.variables).toEqual(["button-fill", "gold"]);
  });

  it("handles alias cycles and ancestor modes without depending on ancestor coordinates", () => {
    const doc = document();
    doc.graph.variables.get("gold").valuesByMode.light = { aliasId: "button-fill" };
    const before = snapshot(doc);
    doc.graph.getNode("buttons").variableModes.colors = "dark";
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "button/hover"]);
    expect(snapshot(doc).targets.screen.dependencies.variables).toEqual(["button-fill", "gold"]);
  });

  it("hashes only referenced image bytes, including images in rich text paint", () => {
    const doc = document();
    doc.graph.getNode("label").styleRuns = [
      { start: 0, length: 1, style: { fills: [{ type: "IMAGE", imageHash: "rich" }] } },
    ];
    doc.graph.images.set("rich", new Uint8Array([4]));
    const before = snapshot(doc);
    doc.graph.images.set("unused", new Uint8Array([9]));
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
    doc.graph.images.set("rich", new Uint8Array([5]));
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "screen"]);
  });

  it("tracks shared style records through source GUIDs and discovers their font families", () => {
    const doc = document();
    doc.graph.getNode("label").textStyleId = "guid/style";
    const before = snapshot(doc);
    doc.graph.getNode("style").fontSize = 18;
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "screen"]);
    expect(snapshot(doc).targets.screen.dependencies.styles).toEqual(["guid/style"]);
  });

  it("invalidates only users of the changed physical font family", () => {
    const doc = document();
    const before = snapshot(doc, { fontFiles: { "Game Serif": "font-v1", "Unused Sans": "unused-v1" } });
    expect(
      compareDesignSnapshots(
        before,
        snapshot(doc, { fontFiles: { "Game Serif": "font-v1", "Unused Sans": "unused-v2" } }),
      ).selected,
    ).toEqual([]);
    expect(
      compareDesignSnapshots(before, snapshot(doc, { fontFiles: { "Game Serif": "font-v2" } })).referenceChanged,
    ).toEqual(["button/default", "screen"]);
  });

  it("follows saved prototype destinations and public instance-swap references", () => {
    const doc = document();
    doc.add("popup", "FRAME", "page", { fills: [{ type: "SOLID", color: "white" }] });
    doc.add("replacement-icon", "COMPONENT", "page", { fills: [{ type: "SOLID", color: "gold" }] });
    doc.graph.getNode("default").reactions = [
      { trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: "popup" }] },
    ];
    doc.manifest.targets[1].figma.properties = { icon: { sourceId: "guid/replacement-icon" } };
    const before = snapshot(doc);
    doc.graph.getNode("popup").fills[0].color = "black";
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "screen"]);
    doc.graph.getNode("popup").fills[0].color = "white";
    doc.graph.getNode("replacement-icon").fills[0].color = "red";
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/hover"]);
  });

  it("tracks native Map-based instance overrides and remains stable when imported runtime handles change", () => {
    const doc = document();
    doc.graph.getNode("button-instance").instanceOverrides = {
      self: new Map(),
      descendants: new Map([["instance-label", new Map([["text", "決定"]])]]),
    };
    const before = snapshot(doc);
    doc.graph.getNode("button-instance").instanceOverrides.descendants.get("instance-label").set("text", "変更");
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["screen"]);
    doc.graph.getNode("button-instance").instanceOverrides.descendants.get("instance-label").set("text", "決定");
    const nodes = [...doc.graph.nodes.values()];
    doc.graph.nodes.clear();
    for (const node of nodes) {
      node.id = `new/${node.id}`;
      node.parentId = node.parentId ? `new/${node.parentId}` : null;
      node.childIds = node.childIds.map((id) => `new/${id}`);
      if (node.componentId) node.componentId = `new/${node.componentId}`;
      if (node.instanceOverrides)
        node.instanceOverrides.descendants = new Map(
          [...node.instanceOverrides.descendants].map(([id, fields]) => [`new/${id}`, fields]),
        );
      doc.graph.nodes.set(node.id, node);
    }
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
  });

  it("keeps source-less variant trees, component references and prototype destinations stable across handle allocation", () => {
    const doc = sourceLessDocument();
    doc.graph.getNode("default").reactions = [
      { trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: "hover" }] },
    ];
    doc.graph.getNode("button-instance").instanceOverrides = {
      self: new Map([["componentId", "default"]]),
      descendants: new Map([["instance-label", new Map([["text", "決定"]])]]),
    };
    const before = snapshot(doc);
    renumberNodes(doc);
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
  });

  it("limits a source-less variant's added child to that variant and its screen after all handles shift", () => {
    const doc = sourceLessDocument();
    const before = snapshot(doc);
    doc.add("new-decoration", "RECTANGLE", "default", {
      source: { id: null },
      fills: [{ type: "SOLID", color: "gold" }],
    });
    renumberNodes(doc);
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "screen"]);
  });

  it("keeps existing variants stable when a new variant is inserted before them on the canvas", () => {
    const doc = sourceLessDocument();
    const before = snapshot(doc);
    doc.add("loading", "COMPONENT", "buttons", { source: { id: null }, componentPropertyValues: { state: "loading" } });
    doc.graph.getNode("buttons").childIds = ["loading", "hover", "default"];
    renumberNodes(doc);
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
  });

  it("ignores source-less node names, order-key metadata and canvas positions while preserving internal z-order", () => {
    const doc = sourceLessDocument();
    const before = snapshot(doc);
    Object.assign(doc.graph.getNode("default"), { name: "Renamed variant", x: 900, y: 700 });
    doc.manifest.targets[0].figma.path[2] = "Renamed variant";
    doc.graph.getNode("label").name = "Renamed layer";
    for (const node of doc.graph.nodes.values()) node.source.orderKey = "rebalanced";
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
    doc.graph.getNode("default").childIds.reverse();
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual(["button/default", "screen"]);
  });

  it("rejects ambiguous source-less variant identities rather than losing one subtree", () => {
    const doc = sourceLessDocument();
    doc.graph.getNode("hover").componentPropertyValues = { state: "default" };
    expect(() => snapshot(doc)).toThrow("Ambiguous stable design node identity");
  });

  it("normalizes typed swap/slot node references while keeping ordinary TEXT values that look like node IDs", () => {
    const doc = sourceLessDocument();
    doc.add("0:777", "COMPONENT", "page", { source: { id: null }, fills: [{ type: "SOLID", color: "blue" }] });
    doc.graph.getNode("buttons").componentPropertyDefinitions.push(
      {
        id: "swap-prop",
        name: "icon",
        type: "INSTANCE_SWAP",
        defaultValue: "0:777",
        preferredValues: ["0:777", "published-library-key"],
      },
      { id: "slot-prop", name: "content", type: "SLOT", defaultValue: "", preferredValues: ["0:777"] },
      { id: "text-prop", name: "label", type: "TEXT", defaultValue: "0:777" },
    );
    doc.graph.getNode("button-instance").componentPropertyAssignments = { "swap-prop": "0:777", "text-prop": "0:777" };
    doc.graph.getNode("label").text = "0:777";
    const before = snapshot(doc);
    const ids = renumberNodes(doc);
    expect(compareDesignSnapshots(before, snapshot(doc)).selected).toEqual([]);
    doc.graph.getNode(ids.get("0:777")).fills[0].color = "red";
    expect(compareDesignSnapshots(before, snapshot(doc)).referenceChanged).toEqual([
      "button/default",
      "button/hover",
      "screen",
    ]);
  });

  it("uses Vite import closures for implementation selection and propagates a child import to its screen", () => {
    const doc = document();
    const options = {
      implementationDependencies: {
        "button/default": ["Button.svelte", "theme.css"],
        "button/hover": ["Button.svelte", "theme.css"],
        screen: ["Screen.svelte", "Button.svelte", "theme.css", "screen.css"],
      },
      fileHashes: {
        "Button.svelte": "button-v1",
        "Screen.svelte": "screen-v1",
        "theme.css": "theme-v1",
        "screen.css": "layout-v1",
      },
    };
    const before = snapshot(doc, options);
    options.fileHashes["screen.css"] = "layout-v2";
    expect(compareDesignSnapshots(before, snapshot(doc, options))).toMatchObject({
      referenceChanged: [],
      implementationChanged: ["screen"],
    });
    options.fileHashes["screen.css"] = "layout-v1";
    expect(
      compareDesignSnapshots(before, snapshot(doc, options), { changedFiles: ["Button.svelte"] }).selected,
    ).toEqual(["button/default", "button/hover", "screen"]);
  });

  it("reports removed cases separately from cases to execute", () => {
    const doc = document();
    const before = snapshot(doc);
    doc.manifest.targets.splice(1, 1);
    expect(compareDesignSnapshots(before, snapshot(doc))).toMatchObject({ selected: [], removed: ["button/hover"] });
  });

  it("rejects incomplete dependency graphs instead of silently skipping changed render inputs", () => {
    const doc = document();
    doc.graph.images.delete("icon");
    expect(() => snapshot(doc)).toThrow("missing referenced image icon");
    doc.graph.images.set("icon", new Uint8Array([1]));
    doc.graph.variables.delete("gold");
    expect(() => snapshot(doc)).toThrow("missing referenced variable gold");
  });

  it("canonicalizes dictionary order but keeps array order and binary resource content", () => {
    expect(designInputHash({ a: 1, b: 2 })).toBe(designInputHash({ b: 2, a: 1 }));
    expect(designInputHash([1, 2])).not.toBe(designInputHash([2, 1]));
    expect(designInputHash(new Uint8Array([0, 255]))).not.toBe(designInputHash(new Uint8Array([255, 0])));
  });
});
