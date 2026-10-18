import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, posix } from "node:path";
import { PNG } from "pngjs";

// Native browser popups use the physical display, independently of the viewport.
export const DESIGN_BROWSER_SCREEN = Object.freeze({ width: 1920, height: 1080 });
export const DESIGN_BROWSER_ARGS = Object.freeze([
  "--no-sandbox",
  "--enable-unsafe-swiftshader",
  "--disable-lcd-text",
  // Retained partial tiles can preserve pixels from an earlier UI state.
  "--disable-partial-raster",
  `--screen-info={0,0 ${DESIGN_BROWSER_SCREEN.width}x${DESIGN_BROWSER_SCREEN.height}}`,
]);
export const DESIGN_BROWSER_LAUNCH = Object.freeze({ headless: true, args: DESIGN_BROWSER_ARGS });

export function assertDesignBrowserScreen(result) {
  if (!Array.isArray(result?.screenInfos) || result.screenInfos.length !== 1)
    throw new Error("Capture requires one physical browser display");
  const expected = {
    left: 0,
    top: 0,
    ...DESIGN_BROWSER_SCREEN,
    availLeft: 0,
    availTop: 0,
    availWidth: DESIGN_BROWSER_SCREEN.width,
    availHeight: DESIGN_BROWSER_SCREEN.height,
    devicePixelRatio: 1,
    colorDepth: 24,
    isPrimary: true,
    isExtended: false,
  };
  const screen = result.screenInfos[0];
  for (const [property, value] of Object.entries(expected))
    if (screen[property] !== value)
      throw new Error(`Physical browser display ${property} must be ${value}; got ${screen[property]}`);
  return Object.fromEntries(Object.keys(expected).map((property) => [property, screen[property]]));
}

export function assertPressedCapture(before, after, expectedValue) {
  for (const state of [before, after]) {
    if (!state?.connected || !state.states?.active || !state.states?.hover)
      throw new Error("Pointer press must remain connected, active and hovered during capture");
    if (expectedValue !== undefined) {
      if (!["input", "select", "textarea"].includes(state.control) || state.value !== expectedValue)
        throw new Error(
          `Pressed control value must remain ${JSON.stringify(expectedValue)}; got ${JSON.stringify(state.value)}`,
        );
    }
  }
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("Pressed control value, geometry, style or state changed during capture");
}

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveInteger = (value) => Number.isInteger(value) && value > 0;

export function captureGeometry(box, padding) {
  const inset =
    typeof padding === "number" ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
  const x = Math.floor(box.x - inset.left);
  const y = Math.floor(box.y - inset.top);
  return {
    clip: {
      x,
      y,
      width: Math.ceil(box.x + box.width + inset.right) - x,
      height: Math.ceil(box.y + box.height + inset.bottom) - y,
    },
  };
}

export function cropPNG(bytes, clip) {
  const image = PNG.sync.read(bytes);
  if (
    ![clip.x, clip.y, clip.width, clip.height].every(Number.isInteger) ||
    clip.x < 0 ||
    clip.y < 0 ||
    clip.width <= 0 ||
    clip.height <= 0 ||
    clip.x + clip.width > image.width ||
    clip.y + clip.height > image.height
  )
    throw new Error("PNG crop must use integer bounds within the viewport");
  if (image.depth !== 8) throw new Error("Expected an 8-bit browser screenshot");
  const output = new PNG({ width: clip.width, height: clip.height });
  for (let y = 0; y < clip.height; y++) {
    const start = ((clip.y + y) * image.width + clip.x) * 4;
    image.data.copy(output.data, y * clip.width * 4, start, start + clip.width * 4);
  }
  return PNG.sync.write(output);
}

export async function clearCaptureBoundary(path, background, padding = 1) {
  const image = PNG.sync.read(await readFile(path));
  const inset =
    typeof padding === "number" ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
  let differentPixels = 0;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      if (
        !(x === 0 && inset.left > 0) &&
        !(x === image.width - 1 && inset.right > 0) &&
        !(y === 0 && inset.top > 0) &&
        !(y === image.height - 1 && inset.bottom > 0)
      )
        continue;
      const offset = (y * image.width + x) * 4;
      if (background.some((value, channel) => image.data[offset + channel] !== value)) differentPixels++;
    }
  return { clear: differentPixels === 0, differentPixels };
}

export function resolveFigmaNode(graph, reference) {
  if (reference?.sourceId) {
    const matches = [...graph.getAllNodes()].filter((node) => node.source?.id === reference.sourceId);
    if (matches.length !== 1)
      throw new Error(`Expected one Figma source GUID ${reference.sourceId}; found ${matches.length}`);
    return matches[0];
  }
  if (
    !Array.isArray(reference?.path) ||
    !reference.path.length ||
    !reference.path.every((name) => typeof name === "string" && name.length)
  )
    throw new Error("Figma reference must declare a sourceId or a complete page/node name path");
  let parent;
  for (const [index, name] of reference.path.entries()) {
    const matches = (index === 0 ? graph.getPages() : graph.getChildren(parent.id)).filter(
      (node) => node.name === name,
    );
    if (matches.length !== 1)
      throw new Error(
        `Expected one Figma path step ${JSON.stringify(reference.path.slice(0, index + 1))}; found ${matches.length}`,
      );
    parent = matches[0];
  }
  return parent;
}

export function resolveCaptureSource(graph, target) {
  return resolveFigmaNode(graph, target.figma);
}

export function resolveNativeInteractions(original, instance, interactions, graph) {
  if (!Array.isArray(interactions)) throw new Error("Native Figma interactions must be an array");
  return interactions.map((interaction) => {
    if (!object(interaction) || interaction.type !== "click")
      throw new Error("Native Figma interaction must declare a click and a node reference");
    let node = resolveFigmaNode(graph, interaction.node);
    const path = [];
    while (node.id !== original.id) {
      path.unshift(node.name);
      node = graph.getNode(node.parentId);
      if (!node) throw new Error("Native interaction trigger is outside the exported Figma target");
    }
    node = instance;
    for (const [index, name] of path.entries()) {
      const matches = graph.getChildren(node.id).filter((child) => child.name === name);
      if (matches.length !== 1)
        throw new Error(
          `Expected one native interaction path step ${JSON.stringify(path.slice(0, index + 1))}; found ${matches.length}`,
        );
      node = matches[0];
    }
    return { type: "click", nodeId: node.id };
  });
}

// Components and screen frames have the same capture contract. The inventory declares
// the states implemented by each real component; it is not inferred from CSS spelling.
export function validateBindings(manifest, graph, { complete = true } = {}) {
  const errors = [];
  if (manifest.version !== 1) errors.push("Expected bindings version 1");
  if (typeof manifest.document !== "string" || !manifest.document.endsWith(".fig"))
    errors.push("Expected a .fig document path");
  if (!Array.isArray(manifest.targets) || !manifest.targets.length) errors.push("Expected nonempty targets");
  if (!Array.isArray(manifest.components)) errors.push("Expected components inventory");
  if (!Array.isArray(manifest.targets) || !Array.isArray(manifest.components)) return errors;
  if (manifest.assets !== undefined && !Array.isArray(manifest.assets)) errors.push("Expected assets inventory");
  const assets = new Map();
  const assetNodes = new Set();
  const inventory = new Map();
  const registeredNodes = new Map();
  const componentNodes = new Map();
  const targetNodes = new Map();
  const activatedOverlays = new Set();
  for (const component of manifest.components ?? []) {
    if (!component.id || inventory.has(component.id)) errors.push(`Duplicate or missing component id: ${component.id}`);
    inventory.set(component.id, component);
    if (typeof component.source !== "string") errors.push(`Missing implementation source: ${component.id}`);
    if (!Array.isArray(component.requiredStates) || !component.requiredStates.length)
      errors.push(`Missing implemented states: ${component.id}`);
    if (!Array.isArray(component.nodes) || !component.nodes.length)
      errors.push(`Missing component nodes: ${component.id}`);
    const resolvedNodes = new Set();
    componentNodes.set(component.id, resolvedNodes);
    for (const reference of Array.isArray(component.nodes) ? component.nodes : []) {
      try {
        const node = resolveFigmaNode(graph, reference);
        if (registeredNodes.has(node.id)) errors.push(`Component node registered more than once: ${node.id}`);
        registeredNodes.set(node.id, component.id);
        resolvedNodes.add(node.id);
        if (node.type !== "COMPONENT") errors.push(`Expected native COMPONENT: ${node.id}`);
      } catch (error) {
        errors.push(`${component.id}: ${error.message}`);
      }
    }
  }
  for (const asset of Array.isArray(manifest.assets) ? manifest.assets : []) {
    if (!object(asset)) {
      errors.push("Expected asset inventory entry");
      continue;
    }
    if (typeof asset.id !== "string" || !asset.id.length || assets.has(asset.id) || inventory.has(asset.id))
      errors.push(`Duplicate or missing asset id: ${asset.id}`);
    assets.set(asset.id, asset);
    if (typeof asset.source !== "string" || !asset.source.length) errors.push(`Missing asset source: ${asset.id}`);
    if (!Array.isArray(asset.nodes) || !asset.nodes.length) errors.push(`Missing asset nodes: ${asset.id}`);
    for (const reference of Array.isArray(asset.nodes) ? asset.nodes : []) {
      try {
        const node = resolveFigmaNode(graph, reference);
        if (registeredNodes.has(node.id)) errors.push(`Asset node registered more than once: ${node.id}`);
        registeredNodes.set(node.id, asset.id);
        assetNodes.add(node.id);
        if (node.type !== "COMPONENT") errors.push(`Expected native asset COMPONENT: ${node.id}`);
      } catch (error) {
        errors.push(`${asset.id}: ${error.message}`);
      }
    }
  }
  const ids = new Set();
  for (const target of manifest.targets ?? []) {
    const label = target.id ?? "(missing id)";
    if (!target.id || ids.has(target.id)) errors.push(`Duplicate or missing target id: ${label}`);
    ids.add(target.id);
    if (!["screen", "component"].includes(target.kind)) errors.push(`Invalid target kind: ${label}`);
    let node;
    try {
      node = resolveFigmaNode(graph, target.figma);
      targetNodes.set(target, node.id);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
    if (assets.has(target.component) || assetNodes.has(node?.id))
      errors.push(`Design assets must not be comparison targets: ${label}`);
    if (node && target.kind === "component" && node.type !== "COMPONENT")
      errors.push(`Component target must reference a native COMPONENT: ${label}`);
    else if (node && target.kind === "screen" && !["FRAME", "COMPONENT"].includes(node.type))
      errors.push(`Screen target must reference a native frame: ${label}`);
    if (target.kind === "component") {
      const component = inventory.get(target.component);
      if (!component) errors.push(`Missing component inventory for ${label}: ${target.component}`);
      else if (node && !componentNodes.get(component.id)?.has(node.id))
        errors.push(`Target node is not registered to ${target.component}: ${label}`);
      if (!target.capture?.selector) errors.push(`Component must declare its capture element: ${label}`);
      if (typeof target.capture?.background !== "string")
        errors.push(`Component must declare its common capture background: ${label}`);
    } else if (typeof target.source !== "string") errors.push(`Missing implementation source: ${label}`);
    if (typeof target.state !== "string") errors.push(`Missing state: ${label}`);
    if (!positiveInteger(target.viewport?.width) || !positiveInteger(target.viewport?.height))
      errors.push(`Viewport must use positive integer pixels: ${label}`);
    if (typeof target.storyId !== "string" || !target.storyId.length)
      errors.push(`Missing implementation story: ${label}`);
    if (target.figma?.properties !== undefined && !object(target.figma.properties))
      errors.push(`Invalid Figma properties: ${label}`);
    if (node && target.figma?.interactions !== undefined) {
      try {
        const interactions = resolveNativeInteractions(node, node, target.figma.interactions, graph);
        for (const interaction of interactions) {
          const trigger = graph.getNode(interaction.nodeId);
          // Only a bound, unambiguous saved click can cover an overlay frame.
          // Unused incoming reactions do not exempt a destination from capture.
          const reactions = trigger.reactions?.filter((reaction) => reaction.trigger.type === "ON_CLICK") ?? [];
          if (reactions.length !== 1 || reactions[0].actions.length !== 1) continue;
          const action = reactions[0].actions[0];
          if (action.type !== "NODE" || action.navigation !== "OVERLAY") continue;
          const destination = graph.getNode(action.destinationId);
          if (destination?.type !== "FRAME") throw new Error("Native overlay destination must reference a FRAME");
          activatedOverlays.add(destination.id);
        }
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
    }
    if (target.figma?.nestedProperties !== undefined) {
      const nested = target.figma.nestedProperties;
      const paths = new Set();
      if (!Array.isArray(nested)) errors.push(`Invalid nested Figma properties: ${label}`);
      else
        for (const entry of nested) {
          if (
            !Array.isArray(entry?.path) ||
            !entry.path.length ||
            !entry.path.every((name) => typeof name === "string" && name.length) ||
            !object(entry.properties)
          )
            errors.push(`Invalid nested Figma properties entry: ${label}`);
          else {
            const path = JSON.stringify(entry.path);
            if (paths.has(path)) errors.push(`Duplicate nested Figma properties path: ${label}/${path}`);
            paths.add(path);
          }
        }
      if (node && node.type !== "COMPONENT" && nested?.length)
        errors.push(`Nested Figma properties require a native COMPONENT: ${label}`);
    }
    if (target.capture?.padding !== undefined) {
      const padding = target.capture.padding;
      const values = object(padding) ? [padding.top, padding.right, padding.bottom, padding.left] : [padding];
      if (!values.every((value) => Number.isInteger(value) && value >= 0))
        errors.push(`Capture padding must use nonnegative integer pixels: ${label}`);
    }
    if (target.capture?.animations !== undefined && !["allow", "disabled"].includes(target.capture.animations))
      errors.push(`Invalid capture animation policy: ${label}`);
    if (
      target.capture?.reducedMotion !== undefined &&
      !["reduce", "no-preference"].includes(target.capture.reducedMotion)
    )
      errors.push(`Invalid capture reduced-motion preference: ${label}`);
    if (target.capture?.phase !== undefined)
      errors.push(`Manual capture phase is unsupported; render an independent story: ${label}`);
    if (
      target.kind === "screen" &&
      (target.capture?.selector || target.capture?.padding || target.capture?.phase || target.capture?.anchor)
    )
      errors.push(`Screens must capture the full viewport: ${label}`);
    const interactions = Array.isArray(target.interaction)
      ? target.interaction
      : target.interaction
        ? [target.interaction]
        : [];
    for (const [index, interaction] of interactions.entries())
      if (
        !object(interaction) ||
        !["hover", "pressed", "focus", "key", "release"].includes(interaction.type) ||
        !interaction.selector ||
        (interaction.position !== undefined &&
          (!["hover", "pressed"].includes(interaction.type) ||
            interaction.method === "keyboard" ||
            !object(interaction.position) ||
            ![interaction.position.x, interaction.position.y].every(
              (value) => Number.isFinite(value) && value >= 0,
            ))) ||
        (interaction.expectedValue !== undefined &&
          (typeof interaction.expectedValue !== "string" ||
            !["pressed", "key"].includes(interaction.type) ||
            interaction.method === "keyboard" ||
            index !== interactions.length - 1)) ||
        (interaction.type === "key" && (typeof interaction.key !== "string" || !interaction.key.length)) ||
        (interaction.type !== "key" && interaction.key !== undefined) ||
        (interaction.method !== undefined && !(interaction.type === "pressed" && interaction.method === "keyboard"))
      )
        errors.push(`Invalid native interaction: ${label}`);
  }
  if (complete) {
    for (const node of graph.getAllNodes())
      if (node.type === "COMPONENT" && !registeredNodes.has(node.id))
        errors.push(`Unregistered native component: ${node.id} ${node.name}`);
    for (const component of inventory.values()) {
      const targets = manifest.targets.filter((target) => target.component === component.id);
      for (const id of componentNodes.get(component.id) ?? [])
        if (!targets.some((target) => targetNodes.get(target) === id))
          errors.push(`Unverified native component/variant: ${id}`);
      for (const state of Array.isArray(component.requiredStates) ? component.requiredStates : [])
        if (!targets.some((target) => target.state === state))
          errors.push(`Unverified implemented state: ${component.id}/${state}`);
    }
    const screens = graph.getPages().filter((page) => page.name === "Screens" || page.name.startsWith("Screens /"));
    if (!screens.length) errors.push("Expected at least one Screens page");
    const visit = (parent) => {
      for (const node of graph.getChildren(parent.id)) {
        if (["FRAME", "COMPONENT"].includes(node.type)) {
          if (
            node.type === "FRAME" &&
            !activatedOverlays.has(node.id) &&
            !manifest.targets.some((target) => target.kind === "screen" && targetNodes.get(target) === node.id)
          )
            errors.push(`Unverified screen frame: ${node.id} ${node.name}`);
        } else if (node.type === "SECTION") visit(node);
      }
    };
    for (const page of screens) visit(page);
  }
  return errors;
}

export function setComponentProperties(instance, properties = {}, graph) {
  const exposed = Object.keys(instance.componentProperties);
  const resolved = {};
  for (const [name, value] of Object.entries(properties)) {
    const keys = exposed.filter((key) => key === name || key.startsWith(`${name}#`));
    if (keys.length !== 1) throw new Error(`Expected one public Figma property ${name}; found ${keys.length}`);
    if (object(value)) {
      const node = resolveFigmaNode(graph, value);
      if (node.type !== "COMPONENT")
        throw new Error(`Instance-swap property ${name} must reference a native component`);
      resolved[keys[0]] = node.id;
    } else resolved[keys[0]] = value;
  }
  instance.setProperties(resolved);
}

export function setNestedComponentProperties(instance, entries = [], graph) {
  if (instance.type !== "INSTANCE") throw new Error("Nested properties require a component instance");
  for (const entry of entries) {
    let node = instance;
    let owner = instance;
    for (const [index, name] of entry.path.entries()) {
      const matches = (node.children ?? []).filter((child) => child.name === name);
      if (matches.length !== 1)
        throw new Error(
          `Expected one nested Figma path step ${JSON.stringify(entry.path.slice(0, index + 1))}; found ${matches.length}`,
        );
      node = matches[0];
      if (node.type === "INSTANCE") {
        if (!node.isExposedInstance || !owner.exposedInstances.some((exposed) => exposed.id === node.id))
          throw new Error(
            `Nested Figma instance is not publicly exposed: ${JSON.stringify(entry.path.slice(0, index + 1))}`,
          );
        owner = node;
      }
    }
    if (node === instance || node.type !== "INSTANCE")
      throw new Error(`Nested Figma properties must reference an INSTANCE: ${JSON.stringify(entry.path)}`);
    setComponentProperties(node, entry.properties, graph);
  }
}

const hash = (value) => createHash("sha256").update(value).digest("hex");

// The exporter numbers image assets separately for every node. Rename by bytes so a
// batch keeps one original image/font, while preserving CSS's relative URL semantics.
export async function writeSharedExport(exported, directory, fileName, written = new Map()) {
  const assets = exported.assets ?? [];
  const paths = new Map();
  const binary = assets.filter((asset) => extname(asset.path) !== ".css");
  const styles = assets.filter((asset) => extname(asset.path) === ".css");
  const save = async (path, content) => {
    const bytes = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
    const digest = hash(bytes);
    if (written.has(path)) {
      if (written.get(path) !== digest) throw new Error(`Conflicting exported asset: ${path}`);
      return;
    }
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), bytes);
    written.set(path, digest);
  };
  for (const asset of binary) {
    const path = `assets/${hash(asset.content)}${extname(asset.path)}`;
    paths.set(asset.path, path);
    await save(path, asset.content);
  }
  for (const asset of styles) {
    let css = String(asset.content);
    for (const [original, path] of paths) {
      const oldRelative = posix.relative(posix.dirname(asset.path), original);
      css = css.replaceAll(oldRelative, basename(path));
    }
    const path = `assets/${hash(css)}.css`;
    paths.set(asset.path, path);
    await save(path, css);
  }
  let html = String(exported.data);
  for (const [original, path] of [...paths].sort(([a], [b]) => b.length - a.length))
    html = html.replaceAll(original, path);
  await writeFile(join(directory, fileName), html);
}
