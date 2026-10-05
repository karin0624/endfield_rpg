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

/** SVG版の実3D四面体。面を奥行き順に重ね、CSSの平面回転による裏返りを防ぐ。 */
export function createTetraMarkup(angle: number): string {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tilt = -0.18;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  const vertices = TETRA_VERTICES.map(([x, y, z]): Point3 => {
    const rotatedX = x * cos + z * sin;
    const rotatedZ = -x * sin + z * cos;
    return [rotatedX, y * cosTilt - rotatedZ * sinTilt, y * sinTilt + rotatedZ * cosTilt];
  });
  const projected: Point3[] = vertices.map(([x, y, z]) => [32 + x * 22, 29 + y * 24, z]);
  const coordinates = (ids: readonly number[]) =>
    ids.map((index) => `${projected[index][0].toFixed(3)},${projected[index][1].toFixed(3)}`).join(" ");
  const orderedFaces = TETRA_FACES.map((indices, index) => ({
    indices,
    index,
    depth: indices.reduce((sum, vertex) => sum + vertices[vertex][2], 0) / 3,
  })).sort((first, second) => first.depth - second.depth);
  const darkFaces = orderedFaces
    .map(
      (face) =>
        `<polygon points="${coordinates(face.indices)}" fill="var(--marker-body)" stroke="var(--marker-body)" stroke-width="7" stroke-linejoin="round"/>`,
    )
    .join("");
  const coloredFaces = orderedFaces
    .map((face) => {
      const engraving =
        face.index === 0
          ? ""
          : (() => {
              const tip = projected[3];
              const rim = face.indices.filter((index) => index !== 3).map((index) => projected[index]);
              return [0.35, 0.58]
                .map((amount) => {
                  const first = rim[0].map((value, index) => value * (1 - amount) + tip[index] * amount);
                  const second = rim[1].map((value, index) => value * (1 - amount) + tip[index] * amount);
                  const middleX = (first[0] + second[0]) / 2;
                  const middleY = (first[1] + second[1]) / 2;
                  return `<path d="M${first[0]},${first[1]} Q${middleX},${middleY + 2.2} ${second[0]},${second[1]}" fill="none" stroke="var(--text-secondary)" stroke-width=".85" opacity=".4"/>`;
                })
                .join("");
            })();
      return `<polygon points="${coordinates(face.indices)}" fill="${TETRA_FACE_COLORS[face.index]}" stroke="var(--marker-edge)" stroke-width="1.8" stroke-linejoin="round"/>${engraving}`;
    })
    .join("");
  return `${darkFaces}${coloredFaces}`;
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
