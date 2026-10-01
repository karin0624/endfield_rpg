export type StatusSeverity = 0 | 1 | 2 | 3;
export type StagedStatusKind = "physicalFatigue" | "haze";
export interface CharacterStatus {
  readonly physicalFatigue: StatusSeverity;
  readonly haze: StatusSeverity;
  readonly incapacityRecoverySteps: number | null;
}
export function healthyStatus(): CharacterStatus {
  return { physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null };
}
export function applyStagedStatus(status: CharacterStatus, kind: StagedStatusKind): CharacterStatus {
  return { ...status, [kind]: Math.min(3, status[kind] + 1) as StatusSeverity };
}
export function applyIncapacity(status: CharacterStatus): CharacterStatus {
  return status.incapacityRecoverySteps === null ? { ...status, incapacityRecoverySteps: 6 } : status;
}
/** One explicit town signal; dungeon actions and HP healing never call this. */
export function recoverTownStep(status: CharacterStatus): CharacterStatus {
  const remaining = status.incapacityRecoverySteps;
  return {
    physicalFatigue: Math.max(0, status.physicalFatigue - 1) as StatusSeverity,
    haze: Math.max(0, status.haze - 1) as StatusSeverity,
    incapacityRecoverySteps: remaining === null || remaining === 1 ? null : remaining - 1,
  };
}
export function effectiveMaxHp(base: number, status: CharacterStatus): number {
  return Math.max(1, Math.floor(base * [1, 0.75, 0.5, 0.25][status.physicalFatigue]));
}
export function effectiveHitRate(base: number, status: CharacterStatus): number {
  return base * [1, 0.9, 0.8, 0.7][status.haze];
}
export function canParticipate(hp: number, status: CharacterStatus = healthyStatus()): boolean {
  return hp > 0 && status.incapacityRecoverySteps === null;
}
