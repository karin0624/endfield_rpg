import type { ItemCatalog } from "../game/items";
import { equipmentCatalog } from "./equipmentDefinitions";
import { itemCatalog } from "./itemSettings";

/** Test-only material/important IDs, alongside approved recovery and equipment definitions. */
export const itemTrials = {
  catalog: [
    ...itemCatalog,
    { id: "trial-material", kind: "material" },
    { id: "trial-important", kind: "important" },
  ] as const satisfies ItemCatalog,
  equipment: equipmentCatalog,
};
