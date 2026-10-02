import { createGameRandom, nextGameRandom } from "./gameRandom";

export type LoadSymptomKind = "physicalFatigue" | "haze";
export type LoadSymptoms = Readonly<Record<LoadSymptomKind, number>>;
export interface LoadSymptomDefinition {
  readonly cap: number;
  readonly scale: number;
  readonly loadCoefficient: number;
  readonly townRecovery: number;
  readonly labelThresholds: readonly [number, number, number];
}
export interface LoadSymptomRules {
  readonly symptoms: Readonly<Record<LoadSymptomKind, LoadSymptomDefinition>>;
  readonly candidates: readonly LoadSymptomKind[];
  readonly probabilityScale: number;
}

function nonnegative(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error("負荷・症状値は有限の非負数です");
}
export function validateLoadSymptomDefinition(definition: LoadSymptomDefinition): void {
  const {
    cap,
    scale,
    loadCoefficient,
    townRecovery,
    labelThresholds: [light, medium, heavy],
  } = definition;
  if (
    ![cap, scale, loadCoefficient, townRecovery, light, medium, heavy].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    light >= medium ||
    medium >= heavy ||
    heavy >= cap
  )
    throw new Error("負荷系症状の調整値が不正です");
}
export function validateLoadSymptom(value: number, definition: LoadSymptomDefinition): void {
  validateLoadSymptomDefinition(definition);
  nonnegative(value);
  if (value > definition.cap) throw new Error("症状値が上限を超えています");
}
export function validateLoadSymptomRules(rules: LoadSymptomRules): void {
  validateLoadSymptomDefinition(rules.symptoms.physicalFatigue);
  validateLoadSymptomDefinition(rules.symptoms.haze);
  if (
    !Number.isFinite(rules.probabilityScale) ||
    rules.probabilityScale <= 0 ||
    new Set(rules.candidates).size !== rules.candidates.length ||
    rules.candidates.some((kind) => kind !== "physicalFatigue" && kind !== "haze")
  )
    throw new Error("追加発症の調整値が不正です");
}

/** Display thresholds never limit accumulation or determine the penalty. */
export function loadSymptomLabel(value: number, definition: LoadSymptomDefinition): string {
  validateLoadSymptom(value, definition);
  const [light, medium, heavy] = definition.labelThresholds;
  return value >= heavy ? "重度" : value >= medium ? "中度" : value >= light ? "軽度" : "なし";
}
export function loadSymptomMultiplier(value: number, definition: LoadSymptomDefinition): number {
  validateLoadSymptom(value, definition);
  return 1 / (1 + value / definition.scale);
}
export function recoverLoadSymptom(value: number, definition: LoadSymptomDefinition): number {
  validateLoadSymptom(value, definition);
  return Math.max(0, value - definition.townRecovery);
}
/** Saturate the dose before adding it, including finite loads whose product overflows. */
export function loadSymptomDose(skillLoad: number, definition: LoadSymptomDefinition): number {
  validateLoadSymptomDefinition(definition);
  nonnegative(skillLoad);
  return Math.min(definition.cap, skillLoad * definition.loadCoefficient);
}
export function accumulateLoadSymptom(value: number, amount: number, definition: LoadSymptomDefinition): number {
  validateLoadSymptom(value, definition);
  nonnegative(amount);
  return Math.min(definition.cap, value + amount);
}
export function additionalSymptomProbability(postUseFatigue: number, probabilityScale: number): number {
  nonnegative(postUseFatigue);
  if (!Number.isFinite(probabilityScale) || probabilityScale <= 0) throw new Error("発症確率の調整値が不正です");
  // Equivalent to f/(scale+f), without overflowing the denominator for large finite inputs.
  return postUseFatigue === 0 ? 0 : 1 / (1 + probabilityScale / postUseFatigue);
}
export interface LoadSymptomApplication {
  readonly kind: LoadSymptomKind;
  readonly before: number;
  readonly after: number;
}

/** Called once by a validated use owner, after all effects and mental-fatigue accumulation.
 * Invalid/cancelled/replayed operations must never reach this function.
 * Empty eligible pool or zero load/probability uses no RNG. Failure uses one draw;
 * success uses an additional uniform selection draw, even with one eligible candidate.
 */
export function applyAdditionalLoadSymptom(
  symptoms: LoadSymptoms,
  postUseFatigue: number,
  skillLoad: number,
  randomState: number,
  rules: LoadSymptomRules,
): {
  readonly symptoms: LoadSymptoms;
  readonly randomState: number;
  readonly application: LoadSymptomApplication | null;
} {
  validateLoadSymptomRules(rules);
  validateLoadSymptom(symptoms.physicalFatigue, rules.symptoms.physicalFatigue);
  validateLoadSymptom(symptoms.haze, rules.symptoms.haze);
  nonnegative(skillLoad);
  createGameRandom(randomState);
  const probability = additionalSymptomProbability(postUseFatigue, rules.probabilityScale);
  const candidates = rules.candidates.filter((kind) => symptoms[kind] < rules.symptoms[kind].cap);
  const unchanged = { symptoms, randomState, application: null };
  if (skillLoad === 0 || probability === 0 || candidates.length === 0) return unchanged;
  const onset = nextGameRandom(randomState);
  if (onset.value >= probability) return { ...unchanged, randomState: onset.state };
  const selection = nextGameRandom(onset.state);
  const kind = candidates[Math.floor(selection.value * candidates.length)];
  const before = symptoms[kind];
  const after = accumulateLoadSymptom(before, loadSymptomDose(skillLoad, rules.symptoms[kind]), rules.symptoms[kind]);
  return {
    symptoms: { ...symptoms, [kind]: after },
    randomState: selection.state,
    application: { kind, before, after },
  };
}
