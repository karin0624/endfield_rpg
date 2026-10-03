import { type ItemCatalog, type ItemState, receiveItems } from "./items";

export interface ItemOffer {
  readonly itemId: string;
  readonly unitPrice: number;
}
/** Caller supplies the currency balance and a current quote. No calendar or recovery operation. */
export function purchaseItem(
  items: ItemState,
  balance: number,
  offer: ItemOffer,
  input: {
    readonly expectedVersion: number;
    readonly explorationId: number;
    readonly transactionId: string;
    readonly quantity: number;
  },
  catalog: ItemCatalog,
) {
  const rejected = { accepted: false as const, items, balance, offer };
  if (items.exploration?.destination !== "town" || items.exploration.id !== input.explorationId) return rejected;
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) return rejected;
  if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(offer.unitPrice) || offer.unitPrice < 0)
    throw new Error("購入用の調整値が不正です");
  const cost = input.quantity * offer.unitPrice;
  if (!Number.isSafeInteger(cost) || cost > balance) return rejected;
  const result = receiveItems(
    items,
    input.expectedVersion,
    `purchase:${input.transactionId}`,
    [{ itemId: offer.itemId, quantity: input.quantity }],
    catalog,
  );
  if (!result.accepted) return rejected;
  return {
    accepted: true as const,
    items: result.state,
    balance: balance - cost,
    offer,
  };
}
