import type { EquipmentDefinition } from "../game/equipment";
import type { ItemCatalog } from "../game/items";

/** Comparison-only proposal, deliberately not imported by initialGameOptions or production UI.
 * Names, economy and equipment acquisition remain undecided. */
export const itemTrials = {
  catalog: [
    { id: "trial-hp-recovery", kind: "consumable", hpRecovery: 8 },
    { id: "trial-material", kind: "material" },
    { id: "trial-important", kind: "important" },
  ] as const satisfies ItemCatalog,
  equipment: [
    { id: "trial-weapon", slot: "weapon", bonuses: { maxHp: 0, attackPower: 1 } },
    { id: "trial-armor", slot: "armor", bonuses: { maxHp: 4, attackPower: 0 } },
  ] as const satisfies readonly EquipmentDefinition[],
  economy: { balance: 30, recoveryPrice: 10, shopStock: 3 },
  /** Compare these probabilities in a test policy; no runtime loss algorithm is selected. */
  retentionProbabilities: [0.25, 0.5, 0.75],
};
