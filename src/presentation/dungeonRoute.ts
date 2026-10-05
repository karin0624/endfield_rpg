export interface RouteNodeMeasure {
  readonly id: string;
  readonly fraction: number;
  /** Actual layout center after the requested width is applied, including native pixel rounding. */
  readonly center: number;
  readonly width: number;
}
export interface RouteMeasure {
  readonly viewportWidth: number;
  readonly responsiveWorldWidth: number;
  readonly nodes: readonly RouteNodeMeasure[];
}
export interface DungeonRoutePresentation {
  readonly measure: RouteMeasure | null;
  readonly offset: number;
  readonly panned: boolean;
  readonly gesture: {
    readonly pointerId: number;
    readonly startX: number;
    readonly startOffset: number;
    readonly dragging: boolean;
  } | null;
}
export type RouteEvent =
  | { readonly type: "measured"; readonly measure: RouteMeasure }
  | { readonly type: "pointer-down"; readonly pointerId: number; readonly x: number; readonly button: number }
  | { readonly type: "pointer-move"; readonly pointerId: number; readonly x: number }
  | { readonly type: "pointer-end"; readonly pointerId: number }
  | { readonly type: "pan-key"; readonly key: string };

export function createDungeonRoute(): DungeonRoutePresentation {
  return { measure: null, offset: 0, panned: false, gesture: null };
}
/** Native widths enter as measurements. The current route determines the fitting and centering rule. */
export function projectRouteLayout(state: DungeonRoutePresentation, accessibleIds: readonly string[]) {
  const measure = state.measure;
  if (!measure) return { width: null, offset: state.offset };
  const accessible = measure.nodes
    .filter(({ id }) => accessibleIds.includes(id))
    .sort((a, b) => a.fraction - b.fraction);
  const left = accessible[0],
    right = accessible.at(-1);
  // No fitted width means retaining the native responsive layout, including its fractional CSS pixels.
  let width: number | null = null;
  if (left && right && left.fraction !== right.fraction) {
    const fitting = Math.floor(
      (measure.viewportWidth - (left.width + right.width) / 2 - 2) / (right.fraction - left.fraction),
    );
    if (fitting > 0 && fitting < measure.responsiveWorldWidth) width = fitting;
  }
  const centers = measure.nodes.map(({ center }) => center);
  const intended =
    state.panned || !accessible.length
      ? state.offset
      : measure.viewportWidth / 2 -
        (Math.min(...accessible.map(({ center }) => center)) + Math.max(...accessible.map(({ center }) => center))) / 2;
  const offset = centers.length
    ? Math.min(
        measure.viewportWidth / 2 - Math.min(...centers),
        Math.max(measure.viewportWidth / 2 - Math.max(...centers), intended),
      )
    : 0;
  return { width, offset };
}
export function reduceDungeonRoute(
  state: DungeonRoutePresentation,
  event: RouteEvent,
  accessibleIds: readonly string[],
) {
  const result = (next = state, handled = true, capture?: number) => ({ state: next, handled, capture });
  if (event.type === "measured") {
    const prior = state.measure,
      measure = event.measure;
    if (
      prior &&
      prior.viewportWidth === measure.viewportWidth &&
      prior.responsiveWorldWidth === measure.responsiveWorldWidth &&
      prior.nodes.length === measure.nodes.length &&
      prior.nodes.every((node, index) => {
        const current = measure.nodes[index];
        return (
          node.id === current.id &&
          node.fraction === current.fraction &&
          node.center === current.center &&
          node.width === current.width
        );
      }) &&
      projectRouteLayout(state, accessibleIds).offset === state.offset
    )
      return result(state);
    const next = { ...state, measure: event.measure };
    return result({ ...next, offset: projectRouteLayout(next, accessibleIds).offset });
  }
  if (event.type === "pointer-down")
    return event.button === 0 && state.gesture === null
      ? result({
          ...state,
          gesture: { pointerId: event.pointerId, startX: event.x, startOffset: state.offset, dragging: false },
        })
      : result(state, false);
  if (event.type === "pan-key") {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return result(state, false);
    const next = { ...state, panned: true, offset: state.offset + (event.key === "ArrowRight" ? -48 : 48) };
    return result({ ...next, offset: projectRouteLayout(next, accessibleIds).offset });
  }
  const gesture = state.gesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return result(state, false);
  if (event.type === "pointer-end") return result({ ...state, gesture: null });
  const delta = event.x - gesture.startX;
  if (!gesture.dragging && Math.abs(delta) <= 3) return result(state, false);
  const next = { ...state, panned: true, gesture: { ...gesture, dragging: true }, offset: gesture.startOffset + delta };
  return result(
    { ...next, offset: projectRouteLayout(next, accessibleIds).offset },
    true,
    gesture.dragging ? undefined : gesture.pointerId,
  );
}

export interface RouteImageMeasure {
  readonly centerX: number;
  readonly centerY: number;
  readonly buttonWidth: number;
  readonly buttonHeight: number;
  readonly imageLeft: number;
  readonly imageTop: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
}
export function projectRouteEdge(
  source: RouteImageMeasure,
  target: RouteImageMeasure,
  world: { readonly width: number; readonly height: number },
): string {
  const anchor = (node: RouteImageMeasure, right: boolean) => ({
    x:
      ((node.centerX - node.buttonWidth / 2 + node.imageLeft + (right ? node.imageWidth + 10 : -10)) / world.width) *
      1000,
    y: ((node.centerY - node.buttonHeight / 2 + node.imageTop + node.imageHeight / 2) / world.height) * 1000,
  });
  const from = anchor(source, true),
    to = anchor(target, false),
    handle = (to.x - from.x) * 0.45;
  return `M ${from.x} ${from.y} C ${from.x + handle} ${from.y}, ${to.x - handle} ${to.y}, ${to.x} ${to.y}`;
}
