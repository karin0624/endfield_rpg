import { type ItemCatalog, type ItemState, mergeStacks } from "./items";

export interface ItemOffer {
  readonly itemId: string;
  readonly unitPrice: number;
}
/** Caller supplies the currency balance and a current quote. No calendar or recovery operation. */
export function purchaseItem(
  items: ItemState,
  balance: number,
  offer: ItemOffer,
  quantity: number,
  catalog: ItemCatalog,
) {
  const rejected = { accepted: false as const, items, balance, offer };
  const exploration = items.exploration;
  if (exploration?.destination !== "town") return rejected;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return rejected;
  if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(offer.unitPrice) || offer.unitPrice < 0)
    throw new Error("購入用の調整値が不正です");
  const cost = quantity * offer.unitPrice;
  if (!Number.isSafeInteger(cost) || cost > balance) return rejected;
  const item = catalog.find(({ id }) => id === offer.itemId);
  if (item?.kind !== "consumable" && item?.kind !== "material") return rejected;
  const acquired = mergeStacks([
    ...exploration.bag.filter(({ origin }) => origin === "acquired"),
    { itemId: offer.itemId, quantity },
  ]);
  return {
    accepted: true as const,
    items: {
      ...items,
      version: items.version + 1,
      exploration: {
        ...exploration,
        bag: [
          ...exploration.bag.filter(({ origin }) => origin === "carried"),
          ...acquired.map((stack) => ({ ...stack, origin: "acquired" as const })),
        ],
      },
    },
    balance: balance - cost,
    offer,
  };
}
