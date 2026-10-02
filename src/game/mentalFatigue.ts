export interface MentalFatigueDefinition {
  readonly scale: number;
  readonly townRecovery: number;
  readonly labelThresholds: readonly [number, number, number];
}
export function validateMentalFatigueDefinition(definition: MentalFatigueDefinition): void {
  const {
    scale,
    townRecovery,
    labelThresholds: [light, medium, heavy],
  } = definition;
  if (
    ![scale, townRecovery, light, medium, heavy].every((n) => Number.isFinite(n) && n > 0) ||
    light >= medium ||
    medium >= heavy
  )
    throw new Error("精神疲労の調整値が不正です");
}
export function validateMentalFatigue(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error("精神疲労は有限の非負数です");
}
/** Continuous trial formula. No fatigue cap or prohibition on using skills. */
export function mentalFatigueMultiplier(value: number, definition: MentalFatigueDefinition): number {
  validateMentalFatigue(value);
  validateMentalFatigueDefinition(definition);
  return 1 / (1 + value / definition.scale);
}
export function recoverMentalFatigue(value: number, definition: MentalFatigueDefinition): number {
  validateMentalFatigue(value);
  validateMentalFatigueDefinition(definition);
  return Math.max(0, value - definition.townRecovery);
}
export function mentalFatigueLabel(value: number, definition: MentalFatigueDefinition): string {
  validateMentalFatigue(value);
  validateMentalFatigueDefinition(definition);
  const [light, medium, heavy] = definition.labelThresholds;
  return value >= heavy ? "重度" : value >= medium ? "中度" : value >= light ? "軽度" : "なし";
}
