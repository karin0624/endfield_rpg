import type { EquipmentDefinition, EquipmentInstance } from "../game/equipment";
/** Approved trial effects and initial stock; not final distribution or economy. */
export const equipmentCatalog = [
  { id: "trial-weapon", slot: "weapon", bonuses: { maxHp: 0, attackPower: 1 } },
  { id: "trial-armor", slot: "armor", bonuses: { maxHp: 4, attackPower: 0 } },
] as const satisfies readonly EquipmentDefinition[];

export const initialEquipment = [
  { instanceId: "weapon-1", definitionId: "trial-weapon" },
  { instanceId: "weapon-2", definitionId: "trial-weapon" },
  { instanceId: "armor-1", definitionId: "trial-armor" },
  { instanceId: "armor-2", definitionId: "trial-armor" },
] as const satisfies readonly EquipmentInstance[];
