import type { EquipmentDefinition } from "../game/equipment";
import type { ItemCatalog } from "../game/items";
import { itemCatalog } from "./itemSettings";

/** Test-only material/important IDs and unapproved equipment proposals. */
export const itemTrials = {
  catalog: [
    ...itemCatalog,
    { id: "trial-material", kind: "material" },
    { id: "trial-important", kind: "important" },
  ] as const satisfies ItemCatalog,
  equipment: [
    { id: "trial-weapon", slot: "weapon", bonuses: { maxHp: 0, attackPower: 1 } },
    { id: "trial-armor", slot: "armor", bonuses: { maxHp: 4, attackPower: 0 } },
  ] as const satisfies readonly EquipmentDefinition[],
};
