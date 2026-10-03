import { initialEquipment } from "../content/equipmentDefinitions";
import { itemCatalog, itemRetentionPolicy, itemSettings } from "../content/itemSettings";
import type { SharedEquipment } from "./equipment";
import { createItemState, type ItemState, returnItems } from "./items";

export interface Inventory {
  readonly equipment: SharedEquipment;
  readonly items: ItemState;
  readonly balance: number;
}
export function createInventory(): Inventory {
  return {
    items: createItemState([], itemCatalog),
    balance: itemSettings.initialBalance,
    equipment: { owned: initialEquipment.map((e) => ({ ...e })), assignments: [] },
  };
}
export function finishInventory(inventory: Inventory, outcome: "cleared" | "defeat" | "retreat", randomState: number) {
  const exploration = inventory.items.exploration;
  if (!exploration) throw new Error("帰還する物品バッグがありません");
  const result = returnItems(
    inventory.items,
    inventory.items.version,
    exploration.id,
    outcome,
    randomState,
    itemRetentionPolicy,
  );
  if (!result.accepted) throw new Error("物品の帰還が拒否されました");
  return { inventory: { ...inventory, items: result.state }, randomState: result.randomState, lost: result.lost ?? [] };
}
