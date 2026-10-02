import type { LoadSymptomRules } from "../game/loadSymptoms";

/** Adjustable trial values, not final balance. Heavy labels are separate from numeric caps. */
export const loadSymptomDefinition = {
  symptoms: {
    physicalFatigue: { cap: 200, scale: 100, loadCoefficient: 1, townRecovery: 10, labelThresholds: [25, 50, 75] },
    haze: { cap: 200, scale: 300, loadCoefficient: 1, townRecovery: 10, labelThresholds: [25, 50, 75] },
  },
  candidates: ["physicalFatigue", "haze"],
  probabilityScale: 100,
} as const satisfies LoadSymptomRules;
