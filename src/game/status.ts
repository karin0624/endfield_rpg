import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import {
  accumulateLoadSymptom,
  type LoadSymptomKind,
  type LoadSymptoms,
  loadSymptomMultiplier,
  recoverLoadSymptom,
  validateLoadSymptom,
} from "./loadSymptoms";

export interface CharacterStatus extends LoadSymptoms {
  readonly incapacityRecoverySteps: number | null;
}
export function healthyStatus(): CharacterStatus {
  return { physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null };
}
export function validateCharacterStatus(status: CharacterStatus): void {
  for (const kind of ["physicalFatigue", "haze"] as const)
    validateLoadSymptom(status[kind], loadSymptomDefinition.symptoms[kind]);
  const steps = status.incapacityRecoverySteps;
  if (steps !== null && (!Number.isInteger(steps) || steps < 1 || steps > 6))
    throw new Error("戦闘不能の回復残りが不正です");
}
export function applyLoadSymptom(status: CharacterStatus, kind: LoadSymptomKind, amount: number): CharacterStatus {
  return { ...status, [kind]: accumulateLoadSymptom(status[kind], amount, loadSymptomDefinition.symptoms[kind]) };
}
export function applyIncapacity(status: CharacterStatus): CharacterStatus {
  return status.incapacityRecoverySteps === null ? { ...status, incapacityRecoverySteps: 6 } : status;
}
/** One explicit town signal; dungeon actions and HP healing never call this. */
export function recoverTownStep(status: CharacterStatus): CharacterStatus {
  const remaining = status.incapacityRecoverySteps;
  return {
    physicalFatigue: recoverLoadSymptom(status.physicalFatigue, loadSymptomDefinition.symptoms.physicalFatigue),
    haze: recoverLoadSymptom(status.haze, loadSymptomDefinition.symptoms.haze),
    incapacityRecoverySteps: remaining === null || remaining === 1 ? null : remaining - 1,
  };
}
export function symptomRecoverySteps(value: number, kind: LoadSymptomKind): number {
  validateLoadSymptom(value, loadSymptomDefinition.symptoms[kind]);
  return Math.ceil(value / loadSymptomDefinition.symptoms[kind].townRecovery);
}
export function effectiveMaxHp(base: number, status: CharacterStatus): number {
  return Math.max(
    1,
    Math.floor(base * loadSymptomMultiplier(status.physicalFatigue, loadSymptomDefinition.symptoms.physicalFatigue)),
  );
}
export function effectiveHitRate(base: number | undefined, status: CharacterStatus): number {
  return (base ?? 1) * loadSymptomMultiplier(status.haze, loadSymptomDefinition.symptoms.haze);
}
export function canParticipate(hp: number, status: CharacterStatus = healthyStatus()): boolean {
  return hp > 0 && status.incapacityRecoverySteps === null;
}
