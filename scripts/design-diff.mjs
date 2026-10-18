import { createHash } from "node:crypto";
import { resolveCaptureSource, resolveFigmaNode } from "./verify-design-bindings.mjs";

// JSON signatures are disposable selection inputs. They are never image baselines.
export const DESIGN_SNAPSHOT_VERSION = 1;

const metadata = new Set([
  "id",
  "name",
  "parentId",
  "childIds",
  "source",
  "locked",
  "expanded",
  "autoRename",
  "guides",
  "layoutGrids",
  "exportSettings",
  "pluginData",
  "pluginRelaunchData",
  "symbolDescription",
  "symbolLinks",
  "componentKey",
  "sourceLibraryKey",
  "publishId",
  "overrideKey",
  "sharedSymbolVersion",
  "publishedVersion",
  "librarySource",
  "isPublishable",
  "isSymbolPublishable",
]);
const nodeReferences = new Set([
  "componentId",
  "sourceComponentId",
  "sourceNodeId",
  "destinationId",
  "nodeId",
  "targetId",
]);
const styleReferences = new Set(["fillStyleId", "strokeStyleId", "textStyleId", "effectStyleId", "gridStyleId"]);

function canonical(value) {
  if (value === undefined) return null;
  if (value instanceof Map)
    return [...value]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([key, item]) => [key, canonical(item)]);
  if (ArrayBuffer.isView(value))
    return { bytes: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64") };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export function designInputHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function lookup(value, key) {
  return value instanceof Map ? value.get(key) : value?.[key];
}

function nodeIdentity(graph) {
  const identities = new Map();
  const owners = new Map();
  const visiting = new Set();
  const identity = (node) => {
    if (identities.has(node.id)) return identities.get(node.id);
    if (visiting.has(node.id)) throw new Error(`Cyclic design node ancestry: ${node.id}`);
    visiting.add(node.id);
    let key = node.source?.id;
    if (!key) {
      if (!node.parentId) key = "document-root";
      else {
        const parent = graph.getNode(node.parentId);
        if (!parent) throw new Error(`Missing parent for source-less design node: ${node.id}`);
        // Imported occurrences intentionally have no file GUID. A variant's public
        // values survive document-wide handle allocation and canvas organization.
        const variant =
          node.type === "COMPONENT" &&
          parent.type === "COMPONENT_SET" &&
          Object.keys(node.componentPropertyValues ?? {}).length > 0;
        const index = parent.childIds.indexOf(node.id);
        if (index < 0) throw new Error(`Missing child position for source-less design node: ${node.id}`);
        key = `${identity(parent)}/${variant ? `variant:${JSON.stringify(canonical(node.componentPropertyValues))}` : `child:${index}`}`;
      }
    }
    const owner = owners.get(key);
    if (owner !== undefined && owner !== node.id) throw new Error(`Ambiguous stable design node identity: ${key}`);
    owners.set(key, node.id);
    identities.set(node.id, key);
    visiting.delete(node.id);
    return key;
  };
  return identity;
}

/**
 * Produce one signature per public design case, using the parsed OpenPencil graph.
 * implementationDependencies is the import closure produced by Vite, keyed by target id
 * or story id; fileHashes contains those repo-relative files' content hashes.
 * fontFiles is keyed by font family and contains its font-file content hash(es).
 * environment contains the pinned exporter/browser/font fallback configuration.
 */
export function createDesignSnapshot(
  graph,
  manifest,
  { environment = {}, fontFiles = {}, implementationDependencies = {}, fileHashes = {} } = {},
) {
  const allNodes = [...graph.getAllNodes()];
  const bySource = new Map(allNodes.filter((node) => node.source?.id).map((node) => [node.source.id, node]));
  const identity = nodeIdentity(graph);
  const propertyTypes = new Map(
    allNodes.flatMap((node) =>
      (node.componentPropertyDefinitions ?? []).map((definition) => [definition.id, definition.type]),
    ),
  );
  const resourceHashes = new Map();
  const targets = {};
  const resourceHash = (kind, id, value) => {
    const key = `${kind}:${id}`;
    if (!resourceHashes.has(key)) resourceHashes.set(key, designInputHash(value));
    return resourceHashes.get(key);
  };

  for (const target of manifest.targets ?? []) {
    if (targets[target.id]) throw new Error(`Duplicate design target: ${target.id}`);
    const root = resolveCaptureSource(graph, target);
    const nodes = new Map();
    const variables = new Map();
    const images = new Map();
    const fonts = new Map();
    const styleIds = new Set();
    const definitions = new Map();
    const collecting = new Set();

    function collectVariable(id) {
      if (variables.has(id)) return;
      const variable = graph.variables.get(id);
      if (!variable) throw new Error(`${target.id}: missing referenced variable ${id}`);
      const collection = graph.variableCollections.get(variable.collectionId);
      if (!collection) throw new Error(`${target.id}: missing variable collection ${variable.collectionId}`);
      // Keep all modes: the HTML exporter emits the token's available modes, including
      // aliases. Unrelated tokens in the same collection are intentionally not included.
      variables.set(id, {
        type: variable.type,
        name: variable.name,
        valuesByMode: variable.valuesByMode,
        unit: variable.unit,
        expressions: variable.expressions,
        codeSyntax: variable.codeSyntax,
        collection: {
          id: collection.id,
          name: collection.name,
          modes: collection.modes,
          defaultModeId: collection.defaultModeId,
          modeAttribute: collection.modeAttribute,
          activeMode: graph.activeMode?.get(collection.id),
        },
      });
      for (const value of Object.values(variable.valuesByMode ?? {}))
        if (value && typeof value === "object" && value.aliasId) collectVariable(value.aliasId);
    }

    function collectReferences(value, key = "") {
      if (!value || typeof value !== "object") {
        if (typeof value !== "string" || !value.length) return value;
        if (
          nodeReferences.has(key) ||
          (key.startsWith("componentPropertyAssignments/") &&
            propertyTypes.get(key.slice("componentPropertyAssignments/".length)) === "INSTANCE_SWAP")
        ) {
          const referenced = graph.getNode(value) ?? bySource.get(value);
          if (!referenced) throw new Error(`${target.id}: missing referenced node ${value}`);
          collectNode(referenced, true);
          return identity(referenced);
        }
        if (styleReferences.has(key)) {
          const style = bySource.get(value) ?? graph.getNode(value);
          if (!style) throw new Error(`${target.id}: missing referenced style ${value}`);
          styleIds.add(identity(style));
          collectNode(style, true);
          return identity(style);
        }
        if (key === "imageHash") {
          const bytes = graph.images.get(value);
          if (!bytes) throw new Error(`${target.id}: missing referenced image ${value}`);
          images.set(value, resourceHash("image", value, bytes));
        }
        if (key === "aliasId" || key.startsWith("boundVariables/")) collectVariable(value);
        return value;
      }
      if (ArrayBuffer.isView(value)) return value;
      if (value instanceof Map)
        return new Map(
          [...value].map(([field, item]) => [
            key === "descendants"
              ? identity(graph.getNode(field) ?? bySource.get(field) ?? missingOverrideTarget(field))
              : field,
            collectReferences(item, field),
          ]),
        );
      if (Array.isArray(value)) return value.map((item) => collectReferences(item, key));
      const result = {};
      for (const [field, item] of Object.entries(value)) {
        if (field === "boundVariables") for (const id of Object.values(item ?? {})) collectVariable(id);
        if (field === "defaultValue" && value.type === "INSTANCE_SWAP") result[field] = collectPropertyNode(item);
        else if (field === "preferredValues" && ["INSTANCE_SWAP", "SLOT"].includes(value.type))
          result[field] = item?.map(collectPropertyNode);
        else if (key === "componentPropertyAssignments" && propertyTypes.get(field) === "INSTANCE_SWAP")
          result[field] = collectPropertyNode(item);
        else result[field] = collectReferences(item, field);
      }
      return result;
    }

    function missingOverrideTarget(id) {
      throw new Error(`${target.id}: missing instance override target ${id}`);
    }

    function collectPropertyNode(value) {
      const node = graph.getNode(value) ?? bySource.get(value);
      // Unlinked preferred values may name a published library key/file GUID.
      // The importer keeps those identifiers; only local values become handles.
      if (!node) return value;
      collectNode(node, true);
      return identity(node);
    }

    function collectNode(node, independentRoot = false) {
      const key = `${identity(node)}:${independentRoot ? "root" : "placed"}`;
      if (nodes.has(key) || collecting.has(key)) return key;
      collecting.add(key);
      const fields = Object.fromEntries(
        Object.entries(node).filter(
          ([field]) => !metadata.has(field) && !(independentRoot && ["x", "y"].includes(field)),
        ),
      );
      if (independentRoot && fields.derivedLayout)
        fields.derivedLayout = Object.fromEntries(
          Object.entries(fields.derivedLayout).filter(([field]) => !["x", "y"].includes(field)),
        );
      if (node.type === "TEXT") {
        const families = new Set([
          node.fontFamily,
          ...(node.styleRuns ?? []).map((run) => run.style?.fontFamily).filter(Boolean),
        ]);
        for (const family of families) if (family) fonts.set(family, lookup(fontFiles, family) ?? null);
      }
      const normalized = collectReferences(fields);
      // Component-set definitions own public variant/text/boolean/swap properties.
      // Their canvas geometry and unrelated variants are not dependencies of this state.
      if (node.type === "COMPONENT") {
        const set = node.parentId ? graph.getNode(node.parentId) : null;
        if (set?.type === "COMPONENT_SET")
          definitions.set(identity(set), collectReferences(set.componentPropertyDefinitions ?? []));
      }
      const children = (node.childIds ?? []).map((id) => {
        const child = graph.getNode(id);
        if (!child) throw new Error(`${target.id}: missing child node ${id}`);
        return collectNode(child);
      });
      nodes.set(key, { ...normalized, children });
      collecting.delete(key);
      return key;
    }

    function collectVariant(node, properties) {
      const main =
        node.type === "INSTANCE" ? (graph.getMainComponent?.(node.id) ?? graph.getNode(node.componentId)) : node;
      const set = main?.parentId ? graph.getNode(main.parentId) : null;
      if (set?.type !== "COMPONENT_SET") return;
      const variantNames = new Set(
        [...(set.componentPropertyDefinitions ?? []), ...(main.componentPropertyDefinitions ?? [])]
          .filter((definition) => definition.type === "VARIANT")
          .map((definition) => definition.name),
      );
      const requested = Object.entries(properties ?? {}).filter(([name]) => variantNames.has(name));
      if (!requested.length) return;
      const values = {
        ...main.componentPropertyValues,
        ...Object.fromEntries(requested.map(([name, value]) => [name, String(value)])),
      };
      const variants = set.childIds
        .map((id) => graph.getNode(id))
        .filter(
          (candidate) =>
            candidate?.type === "COMPONENT" &&
            Object.entries(values).every(([name, value]) => candidate.componentPropertyValues?.[name] === value),
        );
      if (variants.length !== 1)
        throw new Error(`${target.id}: expected one component variant for declared properties`);
      collectNode(variants[0], true);
    }

    collectNode(root, true);
    collectVariant(root, target.figma?.properties);
    // Instance swaps are public component properties, and may not yet occur in the
    // saved instance's child tree. Include their referenced definitions explicitly.
    function collectPropertySwaps(properties) {
      for (const value of Object.values(properties ?? {}))
        if (value && typeof value === "object") collectNode(resolveFigmaNode(graph, value), true);
    }
    collectPropertySwaps(target.figma?.properties);
    for (const entry of target.figma?.nestedProperties ?? []) {
      collectPropertySwaps(entry.properties);
      let nested = root;
      for (const name of entry.path) {
        const matches = nested.childIds.map((id) => graph.getNode(id)).filter((node) => node?.name === name);
        if (matches.length !== 1) throw new Error(`${target.id}: expected one nested property path node ${name}`);
        nested = matches[0];
      }
      collectVariant(nested, entry.properties);
    }

    // Mode inheritance is render input; ancestor positions and editor organization are not.
    const inheritedModes = {};
    let ancestor = root.parentId ? graph.getNode(root.parentId) : null;
    const ancestors = new Set();
    while (ancestor && !ancestors.has(ancestor.id)) {
      ancestors.add(ancestor.id);
      for (const [collection, mode] of Object.entries(ancestor.variableModes ?? {}))
        if (!(collection in inheritedModes)) inheritedModes[collection] = mode;
      ancestor = ancestor.parentId ? graph.getNode(ancestor.parentId) : null;
    }
    const capture = { ...target.capture };
    delete capture.selector;
    const figma = { ...target.figma };
    delete figma.path;
    delete figma.sourceId;
    delete figma.instance;
    const reference = {
      kind: target.kind,
      viewport: target.viewport,
      figma,
      capture,
      environment,
      documentColorSpace: graph.documentColorSpace,
      inheritedModes,
      nodes: [...nodes].sort(([a], [b]) => a.localeCompare(b)),
      definitions: [...definitions].sort(([a], [b]) => a.localeCompare(b)),
      variables: [...variables].sort(([a], [b]) => a.localeCompare(b)),
      images: [...images].sort(([a], [b]) => a.localeCompare(b)),
      fonts: [...fonts].sort(([a], [b]) => a.localeCompare(b)),
    };
    const storyId = target.storyId;
    const files = [
      ...new Set(
        [
          target.source,
          ...((lookup(implementationDependencies, target.id) ?? lookup(implementationDependencies, storyId)) || []),
        ].filter(Boolean),
      ),
    ].sort();
    const implementation = {
      storyId,
      interaction: target.interaction,
      selector: target.capture?.selector,
      viewport: target.viewport,
      environment,
      files: files.map((file) => [file, lookup(fileHashes, file) ?? null]),
    };
    targets[target.id] = {
      referenceHash: designInputHash(reference),
      implementationHash: designInputHash(implementation),
      dependencies: {
        nodes: [
          ...new Set([...[...nodes.keys()].map((key) => key.replace(/:(root|placed)$/, "")), ...definitions.keys()]),
        ].sort(),
        variables: [...variables.keys()].sort(),
        images: [...images.keys()].sort(),
        styles: [...styleIds].sort(),
        fonts: [...fonts.keys()].sort(),
        files,
      },
    };
  }
  return { version: DESIGN_SNAPSHOT_VERSION, targets };
}

/** Select cases only; no cache approval, screenshot generation, or baseline update. */
export function compareDesignSnapshots(previous, current, { changedFiles = [] } = {}) {
  if (current?.version !== DESIGN_SNAPSHOT_VERSION || !current.targets)
    throw new Error("Unsupported current design snapshot");
  const usable = previous?.version === DESIGN_SNAPSHOT_VERSION && previous.targets;
  const changed = new Set(changedFiles);
  const result = { selected: [], referenceChanged: [], implementationChanged: [], added: [], removed: [], reasons: {} };
  for (const [id, target] of Object.entries(current.targets)) {
    const before = usable ? previous.targets[id] : undefined;
    const reasons = [];
    if (!before) {
      result.added.push(id);
      reasons.push(usable ? "added" : "no-compatible-snapshot");
    }
    if (!before || before.referenceHash !== target.referenceHash) {
      result.referenceChanged.push(id);
      reasons.push("design-input");
    }
    if (
      !before ||
      before.implementationHash !== target.implementationHash ||
      target.dependencies.files.some((file) => changed.has(file))
    ) {
      result.implementationChanged.push(id);
      reasons.push("implementation-input");
    }
    if (reasons.length) {
      result.selected.push(id);
      result.reasons[id] = reasons;
    }
  }
  if (usable) for (const id of Object.keys(previous.targets)) if (!(id in current.targets)) result.removed.push(id);
  return result;
}
