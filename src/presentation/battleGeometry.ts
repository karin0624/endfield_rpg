type Point3 = [number, number, number];

const TETRA_VERTICES: readonly Point3[] = [
  [0, -0.59, 1],
  [0.8660254, -0.59, -0.5],
  [-0.8660254, -0.59, -0.5],
  [0, 1.13, 0],
];
const TETRA_FACES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 3, 1],
  [1, 3, 2],
  [2, 3, 0],
];
const TETRA_FACE_COLORS = ["var(--face-top)", "var(--face-dark)", "var(--face-mid)", "var(--face-light)"];

/** Depth-sorted tetrahedron faces for declarative SVG rendering. */
export function projectTetraFaces(angle: number) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle),
    tilt = -0.18;
  const vertices = TETRA_VERTICES.map(([x, y, z]): Point3 => {
    const rotatedX = x * cos + z * sin,
      rotatedZ = -x * sin + z * cos;
    return [rotatedX, y * Math.cos(tilt) - rotatedZ * Math.sin(tilt), y * Math.sin(tilt) + rotatedZ * Math.cos(tilt)];
  });
  const projected = vertices.map(([x, y, z]): Point3 => [32 + x * 22, 29 + y * 24, z]);
  return TETRA_FACES.map((indices, index) => ({
    indices,
    index,
    depth: indices.reduce((sum, vertex) => sum + vertices[vertex][2], 0) / 3,
  }))
    .sort((first, second) => first.depth - second.depth)
    .map(({ indices, index }) => {
      const tip = projected[3],
        rim = indices.filter((vertex) => vertex !== 3).map((vertex) => projected[vertex]);
      return {
        index,
        points: indices
          .map((vertex) => `${projected[vertex][0].toFixed(3)},${projected[vertex][1].toFixed(3)}`)
          .join(" "),
        color: TETRA_FACE_COLORS[index],
        engraving:
          index === 0
            ? []
            : [0.35, 0.58].map((amount) => {
                const first = rim[0].map((value, i) => value * (1 - amount) + tip[i] * amount);
                const second = rim[1].map((value, i) => value * (1 - amount) + tip[i] * amount);
                return `M${first[0]},${first[1]} Q${(first[0] + second[0]) / 2},${(first[1] + second[1]) / 2 + 2.2} ${second[0]},${second[1]}`;
              }),
      };
    });
}

export function projectBattleMarkerAngle(elapsedMs: number): number {
  return 0.1 + ((elapsedMs % 6000) / 6000) * Math.PI * 2;
}

export interface BattleScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly markerX: number;
  readonly markerY: number;
  readonly spriteTop: number;
}
interface CueMeasure {
  readonly width: number;
  readonly height: number;
}
export function projectSequencePositions(measure: {
  readonly stage: CueMeasure;
  readonly actor: CueMeasure;
  readonly impact: CueMeasure;
  readonly number: CueMeasure;
  readonly actorRect?: BattleScreenRect;
  readonly targetRect?: BattleScreenRect;
}) {
  const position = (size: CueMeasure, rect: BattleScreenRect | undefined, offset: number) => ({
    x: Math.max(
      size.width / 2 + 4,
      Math.min(measure.stage.width - size.width / 2 - 4, rect?.markerX ?? measure.stage.width * 0.72),
    ),
    y: Math.max(
      size.height / 2 + 4,
      Math.min(
        measure.stage.height - size.height / 2 - 4,
        (rect ? rect.top + rect.height * 0.4 : measure.stage.height * 0.6) + offset,
      ),
    ),
  });
  return {
    actor: position(measure.actor, measure.actorRect, 48),
    impact: position(measure.impact, measure.targetRect, 0),
    number: position(measure.number, measure.targetRect, 0),
  };
}
