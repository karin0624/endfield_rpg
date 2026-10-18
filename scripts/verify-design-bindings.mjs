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
    phase: { x: box.x - Math.floor(box.x), y: box.y - Math.floor(box.y) },
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

export function emptyViewportReadback(bytes, viewport) {
  const image = PNG.sync.read(bytes);
  if (image.width !== viewport.width || image.height !== viewport.height || !image.data.every((value) => value === 0))
    return undefined;
  return { width: image.width, height: image.height, rgbaBytes: image.data.length, allZero: true };
}

export function nativeSizing(node) {
  return {
    width: node.width,
    height: node.height,
    hugs: {
      x:
        (node.layoutMode === "HORIZONTAL" && node.primaryAxisSizing === "HUG") ||
        (node.layoutMode === "VERTICAL" && node.counterAxisSizing === "HUG"),
      y:
        (node.layoutMode === "VERTICAL" && node.primaryAxisSizing === "HUG") ||
        (node.layoutMode === "HORIZONTAL" && node.counterAxisSizing === "HUG"),
    },
  };
}

export function nativeAnimationTime(target) {
  const time = target.figma?.animationTime;
  if (time === undefined) return undefined;
  if (typeof time !== "number" || !Number.isFinite(time) || time < 0)
    throw new Error("Native animationTime must be a finite nonnegative number of milliseconds");
  if (target.capture?.animations !== "allow") throw new Error("Native animationTime requires capture.animations=allow");
  return time;
}

export function captureCaret(target) {
  const policy = target.capture?.caret ?? "hide";
  if (!["hide", "initial"].includes(policy)) throw new Error("Capture caret must be hide or initial");
  if (
    policy === "initial" &&
    !(
      Array.isArray(target.covers) &&
      target.covers.some((cover) => cover.source?.platform === "text-caret" && cover.source.phase === "on")
    )
  )
    throw new Error("Initial caret capture requires an explicitly observed on-state component");
  return policy;
}

export function assertPaintContained(paint, clip) {
  if (
    !paint ||
    ![paint.x, paint.y, paint.width, paint.height].every(Number.isFinite) ||
    paint.width <= 0 ||
    paint.height <= 0 ||
    paint.x < clip.x ||
    paint.y < clip.y ||
    paint.x + paint.width > clip.x + clip.width ||
    paint.y + paint.height > clip.y + clip.height
  )
    throw new Error("Covered component paint and outsets must be fully inside the compared crop");
}

// This reads the unchanged capture. It neither changes pixels nor supplies an
// expected picture: the rectangle and color must come from the live UA caret.
export function observeCaretBitmap(bytes, clip, rectangle, color, phase) {
  assertPaintContained(rectangle, clip);
  if (
    ![rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(Number.isInteger) ||
    rectangle.width !== 1 ||
    !Array.isArray(color) ||
    color.length !== 4 ||
    !color.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255) ||
    color[3] !== 255 ||
    !["on", "off"].includes(phase)
  )
    throw new Error("Caret phase requires its measured integer UA bar and opaque computed color");
  const png = PNG.sync.read(bytes);
  if (png.width !== clip.width || png.height !== clip.height)
    throw new Error("Caret phase must be observed in the complete unchanged comparison crop");
  let matchingPixels = 0;
  for (let y = rectangle.y; y < rectangle.y + rectangle.height; y++)
    for (let x = rectangle.x; x < rectangle.x + rectangle.width; x++) {
      const offset = ((y - clip.y) * png.width + x - clip.x) * 4;
      if (color.every((channel, index) => channel === png.data[offset + index])) matchingPixels++;
    }
  const visible = matchingPixels === rectangle.width * rectangle.height;
  if (matchingPixels !== (phase === "on" ? rectangle.width * rectangle.height : 0))
    throw new Error("Actual UA caret bitmap differs from its declared phase");
  return { rectangle, color, matchingPixels, totalPixels: rectangle.width * rectangle.height, visible };
}

export function assertSourcePlatformPhase(source, observed) {
  if (!observed?.connected || observed.platform !== source.platform || observed.selector !== source.selector)
    throw new Error("Covered source must be the observed connected platform control");
  if (source.platform === "text-caret") {
    if (
      !["input", "textarea"].includes(observed.control) ||
      !observed.focused ||
      observed.disabled ||
      observed.readOnly ||
      typeof source.empty !== "boolean" ||
      typeof observed.value !== "string" ||
      (observed.value === "") !== source.empty ||
      !observed.caret ||
      !observed.caret.reasonIds?.includes("Caret") ||
      observed.policy !== (source.phase === "on" ? "initial" : "hide")
    )
      throw new Error(
        "Caret coverage requires a focused editable source, measured Caret layer and matching capture phase",
      );
  } else if (source.platform === "select-popup") {
    if (
      source.phase !== "open" ||
      observed.control !== "select" ||
      !observed.focused ||
      observed.disabled ||
      !observed.open ||
      observed.multiple ||
      observed.size > 1 ||
      observed.colorScheme !== "dark" ||
      !Array.isArray(observed.options) ||
      observed.options.length < 1 ||
      observed.options.length > 3 ||
      !observed.plainOptions ||
      !Number.isInteger(source.highlightedIndex) ||
      source.highlightedIndex < 0 ||
      source.highlightedIndex >= observed.options.length
    )
      throw new Error("Popup coverage requires an observed open plain single-select and valid highlighted row");
  } else throw new Error("Unsupported covered source platform");
}

export function assertSelectPopupProperties(source, observed, properties) {
  const mapping = source.optionProperties;
  if (!Array.isArray(mapping) || mapping.length < observed.options.length || mapping.length > 3)
    throw new Error("Popup option properties must cover the real option cardinality");
  const names = new Set();
  for (const [index, row] of mapping.entries()) {
    const option = observed.options[index];
    for (const role of ["label", "visible", "disabled", "highlighted"]) {
      const name = row?.[role];
      if (typeof name !== "string" || !name.length || names.has(name))
        throw new Error("Popup option properties require distinct public names for every row role");
      names.add(name);
      const property = properties[name];
      const expected =
        role === "label"
          ? (option?.label ?? "")
          : role === "visible"
            ? Boolean(option)
            : role === "disabled"
              ? Boolean(option?.disabled)
              : Boolean(option) && index === source.highlightedIndex;
      if (property?.type !== (role === "label" ? "TEXT" : "BOOLEAN") || property.value !== expected)
        throw new Error(`Popup public property differs from its actual source option: ${name}`);
    }
  }
}

// Chrome153's dark native picker uses this platform border and active row.
// Read the original screenshot; neither its pixels nor its geometry are edited.
export function observeSelectPopupBitmap(bytes, clip, source, highlightedIndex) {
  const png = PNG.sync.read(bytes);
  if (png.width !== clip.width || png.height !== clip.height)
    throw new Error("Popup phase must be observed in the complete unchanged comparison crop");
  const border = [133, 133, 133, 255],
    selected = [153, 200, 255, 255];
  const matches = (x, y, color) =>
    color.every((value, channel) => png.data[(y * png.width + x) * 4 + channel] === value);
  const candidates = [],
    count = source.options.length;
  for (let top = 0; top < png.height; top++)
    for (let left = 0; left < png.width; left++) {
      if (!matches(left, top, border) || (left > 0 && matches(left - 1, top, border))) continue;
      let right = left;
      while (right + 1 < png.width && matches(right + 1, top, border)) right++;
      if (right - left + 1 < Math.floor(source.bounds.width)) {
        left = right;
        continue;
      }
      for (let bottom = top + 1; bottom < png.height; bottom++) {
        if (!matches(left, bottom, border) || !matches(right, bottom, border)) break;
        const rowHeight = (bottom - top - 1) / count;
        if (!Number.isInteger(rowHeight) || rowHeight <= 0) continue;
        let complete = true;
        for (let x = left; x <= right; x++)
          if (!matches(x, bottom, border)) {
            complete = false;
            break;
          }
        if (complete) candidates.push({ left, top, right, bottom, rowHeight });
      }
      left = right;
    }
  const rows = source.options.map((_, index) => {
    const color = index === highlightedIndex ? selected : source.background;
    if (!Array.isArray(color) || color.length !== 4 || color[3] !== 255)
      throw new Error("Popup phase requires an opaque actual source background");
    return { index, highlighted: index === highlightedIndex, background: color };
  });
  const matching = candidates.filter(({ left, top, rowHeight }) =>
    rows.every(({ index, background }) => {
      for (let y = top + 1 + index * rowHeight; y < top + 1 + (index + 1) * rowHeight; y++)
        if (!matches(left + 1, y, background)) return false;
      return true;
    }),
  );
  if (!matching.length && candidates.length)
    throw new Error("Actual native popup did not reach its declared highlighted row");
  if (matching.length !== 1)
    throw new Error(`Popup phase requires one complete native border; found ${matching.length}`);
  const { left, top, right, bottom, rowHeight } = matching[0];
  const rectangle = { x: clip.x + left, y: clip.y + top, width: right - left + 1, height: bottom - top + 1 };
  assertPaintContained(rectangle, clip);
  return { rectangle, completeBorder: true, rowHeight, rows, highlightedIndex, border };
}

export function assertCompositeCoverage(target, expected, observed, comparison) {
  const declarations = target.covers ?? [];
  if (!declarations.length) {
    if (observed?.length) throw new Error("Unexpected composite observations");
    return [];
  }
  if (!comparison?.identical || comparison.differentPixels !== 0)
    throw new Error("Composite coverage requires the enclosing all-RGBA comparison to be identical");
  if (
    !Array.isArray(expected) ||
    !Array.isArray(observed) ||
    expected.length !== declarations.length ||
    observed.length !== declarations.length
  )
    throw new Error("Every covered declaration requires a complete source and native observation");
  return declarations.map((cover, index) => {
    const saved = expected[index],
      proof = observed[index];
    if (
      saved.component !== cover.component ||
      saved.state !== cover.state ||
      proof.component !== cover.component ||
      proof.state !== cover.state ||
      saved.mainId !== proof.mainId ||
      saved.nodeId !== proof.nodeId
    )
      throw new Error("Composite observation differs from its registered saved instance/main/state");
    const { source, native, clip } = proof;
    if (!source?.before || !source.after || JSON.stringify(source.before) !== JSON.stringify(source.after))
      throw new Error("Covered source platform state changed or was not observed before and after capture");
    assertSourcePlatformPhase(cover.source, source.before);
    if (!native?.before || !native.after || JSON.stringify(native.before) !== JSON.stringify(native.after))
      throw new Error("Covered native instance changed or was not observed before and after capture");
    const pose = native.before;
    if (
      !pose.connected ||
      !pose.visible ||
      pose.nodeId !== saved.nodeId ||
      pose.ownerNodeId !== saved.ownerNodeId ||
      !pose.belongsToOwner ||
      JSON.stringify(pose.properties) !== JSON.stringify(saved.properties) ||
      !Array.isArray(pose.paint) ||
      !pose.paint.length
    )
      throw new Error("Covered native instance lacks its saved owner/properties/visible paint bounds");
    for (const paint of pose.paint) assertPaintContained(paint, clip);
    if (cover.source.platform === "select-popup") {
      assertSelectPopupProperties(cover.source, source.before, saved.properties);
      const bitmaps = source.bitmaps;
      if (
        !bitmaps?.before ||
        !bitmaps.capture ||
        !bitmaps.after ||
        JSON.stringify(bitmaps.before) !== JSON.stringify(bitmaps.capture) ||
        JSON.stringify(bitmaps.capture) !== JSON.stringify(bitmaps.after) ||
        !bitmaps.capture.completeBorder ||
        bitmaps.capture.highlightedIndex !== cover.source.highlightedIndex ||
        bitmaps.capture.rows?.length !== source.before.options.length
      )
        throw new Error("Popup coverage requires an unchanged complete source window and actual highlighted row");
      const window = bitmaps.capture.rectangle;
      assertPaintContained(window, clip);
      if (
        !saved.overlay ||
        pose.overlay?.destinationId !== saved.overlay.destinationId ||
        pose.overlay?.triggerNodeId !== saved.overlay.triggerNodeId ||
        !pose.overlay.open ||
        !pose.overlay.trusted ||
        pose.overlay.activationCount !== 1 ||
        pose.overlay.mainId !== saved.mainId ||
        JSON.stringify(pose.bounds) !== JSON.stringify(window)
      )
        throw new Error("Popup coverage requires the actual saved overlay activation, main and full window bounds");
    }
    if (cover.source.platform === "text-caret") {
      if (
        !source.bitmap ||
        source.bitmap.visible !== (cover.source.phase === "on") ||
        JSON.stringify(source.bitmap.rectangle) !== JSON.stringify(source.before.caret.rectangle) ||
        JSON.stringify(source.bitmap.color) !== JSON.stringify(source.before.caretColor) ||
        source.bitmap.totalPixels !== source.before.caret.rectangle.width * source.before.caret.rectangle.height ||
        !Number.isInteger(source.bitmap.matchingPixels) ||
        source.bitmap.matchingPixels < 0 ||
        source.bitmap.matchingPixels > source.bitmap.totalPixels ||
        source.bitmap.matchingPixels !== (cover.source.phase === "on" ? source.bitmap.totalPixels : 0) ||
        source.bitmap.visible !== (source.bitmap.matchingPixels === source.bitmap.totalPixels)
      )
        throw new Error("Caret coverage requires its actual source bitmap phase");
      assertPaintContained(source.bitmap.rectangle, clip);
      if (
        !Array.isArray(pose.caret) ||
        pose.caret.length !== 1 ||
        pose.caret[0].ownerNodeId !== saved.nodeId ||
        JSON.stringify(pose.caret[0].rectangle) !== JSON.stringify(source.before.caret.rectangle)
      )
        throw new Error("Covered native Caret physical paint bounds differ from the actual UA caret");
      assertNativeAnimationDestination(
        { mainId: saved.mainId, entryMainId: saved.entryMainId, ownerNodeId: saved.nodeId },
        nativeAnimationTime(target),
        pose.animation,
      );
      const program = pose.animation.programs.find((candidate) => candidate.ownerNodeId === saved.nodeId);
      const targets = new Set(
        pose.animation.animations
          .filter((animation) => program.animationIds.includes(animation.id))
          .map((animation) => animation.targetNodeId),
      );
      if (targets.size !== 1 || !targets.has(pose.caret[0].nodeId))
        throw new Error("Covered Caret paint layer is not the actual saved owner's animation target");
    }
    return { component: cover.component, state: cover.state, mainId: saved.mainId, instanceId: saved.instanceId };
  });
}

export function assertNativeAnimationClock(time, animations) {
  if (typeof time !== "number" || !Number.isFinite(time) || time < 0)
    throw new Error("Native animation clock requires a finite nonnegative time");
  if (!Array.isArray(animations) || animations.length === 0)
    throw new Error("Native animationTime requires an active saved prototype animation");
  const ids = new Set();
  for (const animation of animations) {
    if (typeof animation.id !== "string" || !animation.id.length || ids.has(animation.id))
      throw new Error("Native animation clock requires unique animation identities");
    ids.add(animation.id);
    if (animation.state !== "paused" || animation.pending || animation.time !== time)
      throw new Error(`Native animation clock differs from its requested paused time: ${JSON.stringify(animation)}`);
  }
}

export function assertNativeAnimationDestination(expected, time, observation) {
  assertNativeAnimationClock(time, observation?.animations);
  if (
    ![expected?.mainId, expected?.entryMainId, expected?.ownerNodeId].every((id) => typeof id === "string" && id.length)
  )
    throw new Error("Native animation destination requires registered main, entry and exported owner identities");
  const owners = Array.isArray(observation.programs)
    ? observation.programs.filter((program) => program.ownerNodeId === expected.ownerNodeId)
    : [];
  if (owners.length !== 1) throw new Error("Native animation destination requires one unambiguous exported owner");
  const program = owners[0];
  const ids = new Set(observation.animations.map((animation) => animation.id));
  if (
    !Array.isArray(program.animationIds) ||
    !program.animationIds.length ||
    new Set(program.animationIds).size !== program.animationIds.length ||
    !program.animationIds.every((id) => ids.has(id))
  )
    throw new Error("Native animation destination has no matching actual owner animations");
  const { endpoints, segments } = program;
  if (
    !Array.isArray(endpoints) ||
    !endpoints.length ||
    !endpoints.every(
      (endpoint, index) =>
        typeof endpoint.variantId === "string" &&
        endpoint.variantId.length &&
        Number.isFinite(endpoint.at) &&
        endpoint.at >= 0 &&
        (index === 0 || endpoint.at >= endpoints[index - 1].at),
    ) ||
    endpoints[0].at !== 0 ||
    endpoints[0].variantId !== expected.entryMainId ||
    !Array.isArray(segments) ||
    !segments.every(
      (segment) =>
        typeof segment.sourceId === "string" &&
        typeof segment.destinationId === "string" &&
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.start >= 0 &&
        segment.end >= segment.start,
    )
  )
    throw new Error("Native animation destination requires the saved entry and ordered runtime endpoints/segments");
  const reached = endpoints.findLast((endpoint) => endpoint.at <= time);
  const segment = segments.find((candidate) => candidate.start <= time && candidate.end > time);
  if (
    program.variantId !== expected.mainId ||
    reached?.variantId !== expected.mainId ||
    program.targetId !== segment?.destinationId ||
    program.progress !== (segment ? String((time - segment.start) / (segment.end - segment.start)) : undefined)
  )
    throw new Error("Native animation has not reached the registered destination state");
  const last = endpoints.at(-1);
  const exactEndpoint = reached.at === time;
  const ownerAnimations = observation.animations.filter((animation) => program.animationIds.includes(animation.id));
  const afterFinal =
    time > last.at &&
    reached === last &&
    !segment &&
    ownerAnimations.every((animation) => Number.isFinite(animation.iterations) && animation.iterations > 0);
  if (!exactEndpoint && !afterFinal)
    throw new Error("Native animation destination must be at an exact endpoint or after its finite final endpoint");
  return { ownerNodeId: expected.ownerNodeId, mainId: expected.mainId, endpoint: reached.at, time, afterFinal };
}

export function nativeCapturePlacement(nominal, origin, node) {
  const { hugs } = nativeSizing(node);
  return {
    x: nominal.x - origin.x + (hugs.x && node.horizontalConstraint === "CENTER" ? (nominal.width - node.width) / 2 : 0),
    y: nominal.y - origin.y + (hugs.y && node.verticalConstraint === "CENTER" ? (nominal.height - node.height) / 2 : 0),
  };
}

export function nativeGeometryMatches(nominal, native, declared) {
  return (
    nominal.x === native.x &&
    nominal.y === native.y &&
    nominal.width === (declared.hugs?.x ? native.width : declared.width) &&
    nominal.height === (declared.hugs?.y ? native.height : declared.height)
  );
}

export async function clearCaptureBoundary(path, background) {
  const image = PNG.sync.read(await readFile(path));
  let differentPixels = 0;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      if (x !== 0 && x !== image.width - 1 && y !== 0 && y !== image.height - 1) continue;
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
  const main = resolveFigmaNode(graph, target.figma);
  if (target.figma.instance === undefined) return main;
  if (target.kind !== "component" || main.type !== "COMPONENT")
    throw new Error("An existing Figma instance requires a native COMPONENT target");
  const instance = resolveFigmaNode(graph, target.figma.instance);
  if (instance.type !== "INSTANCE") throw new Error("Figma instance capture must reference a saved INSTANCE");
  if (instance.componentId !== main.id)
    throw new Error("Figma instance capture must use the registered main component");
  return instance;
}

export function resolveNativeScroll(root, scroll, graph) {
  if (
    !object(scroll) ||
    !Array.isArray(scroll.path) ||
    !scroll.path.every((name) => typeof name === "string" && name.length) ||
    ![scroll.top ?? 0, scroll.left ?? 0].every((value) => Number.isFinite(value) && value >= 0)
  )
    throw new Error("Native scroll must declare a relative path and nonnegative finite top/left");
  let node = root;
  for (const [index, name] of scroll.path.entries()) {
    const matches = graph.getChildren(node.id).filter((child) => child.name === name);
    if (matches.length !== 1)
      throw new Error(
        `Expected one scroll Figma path step ${JSON.stringify(scroll.path.slice(0, index + 1))}; found ${matches.length}`,
      );
    node = matches[0];
  }
  if (!["FRAME", "INSTANCE"].includes(node.type))
    throw new Error(`Native scroll must reference a FRAME or INSTANCE: ${JSON.stringify(scroll.path)}`);
  const top = scroll.top ?? 0;
  const left = scroll.left ?? 0;
  if (top > 0 && !["VERTICAL", "BOTH"].includes(node.overflowDirection))
    throw new Error(`Native scroll frame does not support vertical scrolling: ${JSON.stringify(scroll.path)}`);
  if (left > 0 && !["HORIZONTAL", "BOTH"].includes(node.overflowDirection))
    throw new Error(`Native scroll frame does not support horizontal scrolling: ${JSON.stringify(scroll.path)}`);
  return { nodeId: node.id, top, left };
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

function pathWithin(graph, root, node) {
  const path = [];
  for (let current = node; current; current = graph.getNode(current.parentId)) {
    if (current.id === root.id) return path;
    path.unshift(current.name);
  }
  return undefined;
}

export function resolveCompositeComponent(graph, target, cover) {
  if (!object(cover) || typeof cover.component !== "string" || typeof cover.state !== "string")
    throw new Error("Covered component must declare a registered responsibility and state");
  if (!object(cover.figma?.properties)) throw new Error("Covered component must declare its public properties");
  if (
    !object(cover.source) ||
    typeof cover.source.selector !== "string" ||
    !cover.source.selector.length ||
    !["text-caret", "select-popup"].includes(cover.source.platform) ||
    !(cover.source.platform === "text-caret" ? ["on", "off"] : ["open"]).includes(cover.source.phase)
  )
    throw new Error("Covered component requires an actual platform selector and supported phase");
  const main = resolveFigmaNode(graph, cover.figma.main);
  const instance = resolveFigmaNode(graph, cover.figma.instance);
  if (main.type !== "COMPONENT" || instance.type !== "INSTANCE")
    throw new Error("Covered component must reference a native COMPONENT and saved INSTANCE");
  const entry = graph.getMainComponent(instance.id);
  const source = resolveCaptureSource(graph, target);
  if (cover.source.platform === "select-popup") {
    if (entry?.id !== main.id) throw new Error("Popup coverage requires its exact saved static component main");
    if (!Number.isInteger(cover.source.highlightedIndex) || cover.source.highlightedIndex < 0)
      throw new Error("Popup coverage requires an explicit highlighted option index");
    const mapping = cover.source.optionProperties;
    if (!Array.isArray(mapping) || mapping.length < 1 || mapping.length > 3)
      throw new Error("Popup coverage requires ordinary public option-property mappings");
    const names = new Set();
    const definitions = [
      ...(main.componentPropertyDefinitions ?? []),
      ...(graph.getNode(main.parentId)?.type === "COMPONENT_SET"
        ? (graph.getNode(main.parentId).componentPropertyDefinitions ?? [])
        : []),
    ];
    const descendants = [];
    const visit = (node) => {
      descendants.push(node);
      for (const child of graph.getChildren(node.id)) visit(child);
    };
    visit(main);
    for (const row of mapping)
      for (const role of ["label", "visible", "disabled", "highlighted"]) {
        const name = row?.[role],
          type = role === "label" ? "TEXT" : "BOOLEAN";
        if (
          typeof name !== "string" ||
          !name.length ||
          names.has(name) ||
          typeof cover.figma.properties[name] !== (role === "label" ? "string" : "boolean")
        )
          throw new Error("Popup mappings require distinct typed declared public properties");
        names.add(name);
        const matches = definitions.filter((definition) => definition.name === name && definition.type === type);
        if (
          matches.length !== 1 ||
          !descendants.some((node) =>
            (node.componentPropertyReferences ?? []).some(
              (reference) =>
                reference.propertyId === matches[0].id && reference.field === (role === "label" ? "TEXT" : "VISIBLE"),
            ),
          )
        )
          throw new Error(`Popup property must bind real ordinary option content: ${name}`);
      }
    const matches = [];
    for (const action of resolveNativeInteractions(source, source, target.figma.interactions ?? [], graph)) {
      const trigger = graph.getNode(action.nodeId);
      const reactions = trigger.reactions?.filter((reaction) => reaction.trigger.type === "ON_CLICK") ?? [];
      if (reactions.length !== 1 || reactions[0].actions.length !== 1) continue;
      const overlay = reactions[0].actions[0],
        destination = graph.getNode(overlay.destinationId);
      if (
        overlay.type === "NODE" &&
        overlay.navigation === "OVERLAY" &&
        destination?.type === "FRAME" &&
        pathWithin(graph, destination, instance)
      )
        matches.push({ destinationId: destination.id, triggerSourceId: trigger.id });
    }
    if (pathWithin(graph, source, instance) || matches.length !== 1)
      throw new Error("Popup coverage requires one declared saved click reaching its independent overlay instance");
    return { main, instance, entry, source, overlay: matches[0] };
  }
  if (typeof cover.source.empty !== "boolean")
    throw new Error("Caret coverage must declare the actual source Empty/Filled condition");
  if (
    entry?.type !== "COMPONENT" ||
    main.parentId !== entry.parentId ||
    graph.getNode(main.parentId)?.type !== "COMPONENT_SET" ||
    nativeAnimationTime(target) === undefined
  )
    throw new Error("Caret coverage requires a saved same-set prototype instance and native clock");
  if (captureCaret(target) !== (cover.source.phase === "on" ? "initial" : "hide"))
    throw new Error("Source caret capture policy differs from the declared component phase");
  const path = pathWithin(graph, source, instance);
  if (path) return { main, instance, entry, source, path };
  throw new Error("Covered instance is outside the exported owner");
}

export function resolveCompositeClone(graph, current, resolved) {
  if (resolved.overlay) return resolved.instance;
  let node = current;
  for (const [index, name] of resolved.path.entries()) {
    const matches = graph.getChildren(node.id).filter((child) => child.name === name);
    if (matches.length !== 1)
      throw new Error(
        `Expected one covered instance path ${JSON.stringify(resolved.path.slice(0, index + 1))}; found ${matches.length}`,
      );
    node = matches[0];
  }
  if (node.type !== "INSTANCE") throw new Error("Covered native capture must retain its saved instance role");
  return node;
}

export function observeCompositeProperties(api, graph, instance, main, expected) {
  const properties = api.wrapNode(instance.id).componentProperties;
  const variants = main.componentPropertyValues ?? {};
  const values = {};
  const matched = new Set();
  for (const [name, declared] of Object.entries(expected)) {
    const keys = Object.keys(properties).filter((key) => key === name || key.startsWith(`${name}#`));
    if (keys.length !== 1) throw new Error(`Expected one covered public property ${name}; found ${keys.length}`);
    const key = keys[0],
      property = properties[key];
    matched.add(key);
    const value = property.type === "VARIANT" ? variants[name] : property.value;
    const requested = object(declared) ? resolveFigmaNode(graph, declared).id : declared;
    if (value !== requested) throw new Error(`Covered public property differs: ${name}`);
    values[name] = { type: property.type, value };
  }
  for (const [key, property] of Object.entries(properties))
    if (property.type !== "VARIANT" && !matched.has(key)) throw new Error(`Missing covered public property: ${key}`);
  return values;
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
  const plannedCoverage = new Map();
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
    let captureSource;
    try {
      node = resolveFigmaNode(graph, target.figma);
      targetNodes.set(target, node.id);
      captureSource = resolveCaptureSource(graph, target);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
    if (assets.has(target.component) || assetNodes.has(node?.id) || assetNodes.has(captureSource?.id))
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
    try {
      nativeAnimationTime(target);
      captureCaret(target);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
    const covered = [];
    plannedCoverage.set(target, covered);
    if (target.covers !== undefined && !Array.isArray(target.covers))
      errors.push(`Covered components must be an array: ${label}`);
    else {
      const identities = new Set();
      for (const cover of target.covers ?? []) {
        try {
          if (assets.has(cover.component)) throw new Error("Design assets must not be covered components");
          const resolved = resolveCompositeComponent(graph, target, cover);
          if (assetNodes.has(resolved.main.id)) throw new Error("Design assets must not be covered components");
          const component = inventory.get(cover.component);
          if (!component || !componentNodes.get(cover.component)?.has(resolved.main.id))
            throw new Error("Covered main is not registered to the declared component responsibility");
          if (!component.requiredStates.includes(cover.state))
            throw new Error("Covered state is not an inventoried implemented component state");
          const identity = JSON.stringify([cover.component, cover.state, resolved.instance.id]);
          if (identities.has(identity)) throw new Error("Duplicate covered component observation");
          identities.add(identity);
          covered.push({ component: cover.component, state: cover.state, mainId: resolved.main.id });
        } catch (error) {
          errors.push(`${label}: ${error.message}`);
        }
      }
    }
    if (captureSource && target.figma?.interactions !== undefined) {
      try {
        const interactions = resolveNativeInteractions(captureSource, captureSource, target.figma.interactions, graph);
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
    if (target.figma?.scroll !== undefined) {
      const scroll = target.figma.scroll;
      if (
        !object(scroll) ||
        !Array.isArray(scroll.path) ||
        !scroll.path.every((name) => typeof name === "string" && name.length) ||
        ![scroll.top ?? 0, scroll.left ?? 0].every((value) => Number.isFinite(value) && value >= 0)
      )
        errors.push(`Invalid native Figma scroll: ${label}`);
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
        if (
          !targets.some((target) => targetNodes.get(target) === id) &&
          ![...plannedCoverage.values()].some((covers) =>
            covers.some((cover) => cover.component === component.id && cover.mainId === id),
          )
        )
          errors.push(`Unverified native component/variant: ${id}`);
      for (const state of Array.isArray(component.requiredStates) ? component.requiredStates : [])
        if (
          !targets.some((target) => target.state === state) &&
          ![...plannedCoverage.values()].some((covers) =>
            covers.some((cover) => cover.component === component.id && cover.state === state),
          )
        )
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
