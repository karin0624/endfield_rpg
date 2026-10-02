import type { MentalFatigueDefinition } from "../game/mentalFatigue";
/** Trial tuning, not user-decided balance. Additional symptom onset is not connected. */
export const mentalFatigueDefinition = {
  scale: 100,
  townRecovery: 10,
  labelThresholds: [25, 50, 75],
} as const satisfies MentalFatigueDefinition;
