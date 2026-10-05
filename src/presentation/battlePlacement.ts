import type { BattleScreenRect } from "./battleGeometry";

export function projectEnemyOverlay(
  rect: BattleScreenRect | undefined,
  visible: boolean,
  index: number,
  stageWidth: number,
) {
  return rect && visible
    ? { box: rect, x: rect.markerX, y: Math.max(8, rect.spriteTop - 8 - (stageWidth <= 540 && index === 0 ? 30 : 0)) }
    : null;
}
export function projectTargetMarker(
  rect: BattleScreenRect | undefined,
  label: { readonly visible: boolean; readonly top: number; readonly height: number },
  markerHeight: number,
) {
  return rect && label.visible
    ? { x: rect.markerX, y: Math.max(markerHeight + 4, label.top - label.height - 4) }
    : null;
}
interface Bounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
export function projectMobileLabelSeparation(
  stageWidth: number,
  marker: Bounds,
  label: Bounds,
  currentTop: number,
  labelHeight: number,
) {
  const overlaps =
    label.left < marker.right && label.right > marker.left && label.top < marker.bottom && label.bottom > marker.top;
  return stageWidth <= 540 && overlaps
    ? Math.max(labelHeight + 4, currentTop - (label.bottom - marker.top + 4))
    : currentTop;
}
export interface PartyAnchorMeasure {
  readonly width: number;
  readonly font: string;
  readonly height: number;
}
export interface PartyMeasurement extends PartyAnchorMeasure {
  readonly absolute: boolean;
}
export function projectPartyAnchor(previous: PartyAnchorMeasure | null, measure: PartyMeasurement) {
  if (!measure.absolute) return null;
  if (previous && previous.width === measure.width && previous.font === measure.font) return previous;
  return { width: measure.width, font: measure.font, height: measure.height };
}
export function projectPartyOverflow(anchored: boolean, boardBottom: number, cardBottoms: readonly number[]): boolean {
  return anchored && cardBottoms.some((bottom) => bottom > boardBottom);
}
