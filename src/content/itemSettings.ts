import type { ItemOffer } from "../game/itemPurchase";
import { independentItemRetention } from "../game/itemRetention";
import type { ItemCatalog } from "../game/items";

/** Approved trial settings, adjustable independently of the core. Not final game balance. */
export const itemSettings = {
  hpRecovery: 8,
  recoveryPrice: 10,
  initialBalance: 30,
  retentionProbability: 0.5,
} as const;
export const recoveryItemId = "hp-recovery";
export const itemCatalog = [
  { id: recoveryItemId, kind: "consumable", hpRecovery: itemSettings.hpRecovery },
] as const satisfies ItemCatalog;
/** No sale limit or shop stock counter is introduced. */
export const recoveryItemOffer: ItemOffer = { itemId: recoveryItemId, unitPrice: itemSettings.recoveryPrice };
export const itemRetentionPolicy = independentItemRetention(itemSettings.retentionProbability);
