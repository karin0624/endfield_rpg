import { describe, expect, it, vi } from "vitest";
import { itemTrials } from "../content/itemTrials";
import { nextGameRandom } from "./gameRandom";
import { purchaseItem } from "./itemPurchase";
import {
  acquireImportantItem,
  consumeBagItem,
  createItemState,
  type ItemResult,
  packItems,
  type RetentionPolicy,
  receiveItems,
  returnItems,
} from "./items";

const catalog = itemTrials.catalog;
const hp = "trial-hp-recovery";
const material = "trial-material";
function accepted(result: ItemResult) {
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
function home() {
  return createItemState(
    [
      { itemId: hp, quantity: 5 },
      { itemId: material, quantity: 3 },
    ],
    catalog,
  );
}
function depart(destination: "town" | "dungeon" = "dungeon") {
  return accepted(
    packItems(
      home(),
      0,
      7,
      destination,
      [
        { itemId: hp, quantity: 3 },
        { itemId: material, quantity: 2 },
      ],
      catalog,
    ),
  );
}
/** Test-only independent unit sampling; production has no chosen loss algorithm. */
const halfRetention: RetentionPolicy = (bag, seed) => {
  let randomState = seed;
  const quantities = bag.map(({ quantity }) => {
    let kept = 0;
    for (let i = 0; i < quantity; i++) {
      const roll = nextGameRandom(randomState);
      randomState = roll.state;
      if (roll.value < 0.5) kept++;
    }
    return kept;
  });
  return { quantities, randomState };
};
describe("物品の保管・探索・帰還", () => {
  it("選択数だけホームから移し、同品目の獲得分と持込み分を識別する", () => {
    const start = depart();
    expect(start.home).toEqual([
      { itemId: hp, quantity: 2 },
      { itemId: material, quantity: 1 },
    ]);
    const looted = accepted(receiveItems(start, start.version, "battle:1", [{ itemId: hp, quantity: 2 }], catalog));
    expect(looted.exploration?.bag).toEqual([
      { itemId: hp, quantity: 3, origin: "carried" },
      { itemId: material, quantity: 2, origin: "carried" },
      { itemId: hp, quantity: 2, origin: "acquired" },
    ]);
    expect(receiveItems(looted, looted.version, "battle:1", [{ itemId: hp, quantity: 2 }], catalog).accepted).toBe(
      false,
    );
    const consumed = accepted(consumeBagItem(looted, looted.version, hp, "acquired", catalog));
    const back = returnItems(consumed, consumed.version, 7, "cleared", 123);
    expect(back.accepted).toBe(true);
    expect(back.state.home).toEqual([
      { itemId: hp, quantity: 6 },
      { itemId: material, quantity: 3 },
    ]);
    expect(back.randomState).toBe(123);
    expect(back.lost).toEqual([]);
    expect(returnItems(back.state, back.state.version, 7, "cleared", 123).accepted).toBe(false);
  });
  it.each(["defeat", "retreat"] as const)("%sは持込み消耗品・素材と獲得品を同じ注入抽選へ渡す", (outcome) => {
    const start = depart();
    const looted = accepted(
      receiveItems(start, start.version, "event:1", [{ itemId: material, quantity: 2 }], catalog),
    );
    const permanent = accepted(acquireImportantItem(looted, "trial-important", catalog));
    const policy = vi.fn(halfRetention);
    const result = returnItems(permanent, permanent.version, 7, outcome, 1, policy);
    expect(result.accepted).toBe(true);
    // Seed 1: rolls .236,.369,.504 / .705,.050 / .369,.775.
    expect(result.state.home).toEqual([
      { itemId: hp, quantity: 4 },
      { itemId: material, quantity: 3 },
    ]);
    expect(result.lost).toEqual([
      { itemId: hp, quantity: 1, origin: "carried" },
      { itemId: material, quantity: 1, origin: "carried" },
      { itemId: material, quantity: 1, origin: "acquired" },
    ]);
    expect(result.state.importantIds).toEqual(["trial-important"]);
    expect(result.randomState).toBe(3327581586);
    // Round trip of the pure state, not a claim of production save integration.
    const restored = JSON.parse(JSON.stringify(result.state));
    expect(returnItems(restored, permanent.version, 7, outcome, result.randomState, policy).accepted).toBe(false);
    expect(policy).toHaveBeenCalledTimes(1);
  });
  it("重要品は永続集合で重複せず、持込みも消費もできない", () => {
    const important = accepted(acquireImportantItem(home(), "trial-important", catalog));
    const again = accepted(acquireImportantItem(important, "trial-important", catalog));
    expect(again.importantIds).toEqual(["trial-important"]);
    expect(
      packItems(again, again.version, 7, "town", [{ itemId: "trial-important", quantity: 1 }], catalog).accepted,
    ).toBe(false);
    expect(consumeBagItem(depart(), 1, "trial-important", "carried", catalog).accepted).toBe(false);
  });
  it("上限なしで持込みでき、重複行を合算して不足・不正数を拒否する", () => {
    const large = createItemState([{ itemId: hp, quantity: 10000 }], catalog);
    expect(packItems(large, 0, 7, "town", [{ itemId: hp, quantity: 10000 }], catalog).accepted).toBe(true);
    expect(
      packItems(
        home(),
        0,
        7,
        "town",
        [
          { itemId: hp, quantity: 3 },
          { itemId: hp, quantity: 3 },
        ],
        catalog,
      ).accepted,
    ).toBe(false);
    for (const quantity of [-1, 0, 1.5, Number.NaN])
      expect(packItems(home(), 0, 7, "town", [{ itemId: hp, quantity }], catalog).accepted).toBe(false);
    expect(packItems(depart(), 1, 8, "town", [], catalog).accepted).toBe(false);
  });
  it("クリアは抽選せず、未決のロスト方針や不正な保持数を暗黙補完しない", () => {
    const start = depart();
    const policy = vi.fn(halfRetention);
    expect(returnItems(start, 1, 7, "cleared", 1, policy).accepted).toBe(true);
    expect(policy).not.toHaveBeenCalled();
    expect(() => returnItems(start, 1, 7, "retreat", 1)).toThrow();
    expect(() => returnItems(start, 1, 7, "defeat", 1, () => ({ quantities: [4, 2], randomState: 1 }))).toThrow();
    expect(returnItems(start, 1, 8, "defeat", 1, policy).accepted).toBe(false);
    expect(policy).not.toHaveBeenCalled();
  });
});
describe("注入価格による街探索中の購入", () => {
  const offer = { itemId: hp, unitPrice: 10, stock: 3 };
  const input = { expectedVersion: 1, explorationId: 7, transactionId: "1", quantity: 2 };
  it("金額・在庫・バッグを一度に更新し、連打と復元後の同じ取引を拒否する", () => {
    const bought = purchaseItem(depart("town"), 30, offer, input, catalog);
    expect(bought.accepted).toBe(true);
    expect(bought.balance).toBe(10);
    expect(bought.offer.stock).toBe(1);
    expect(bought.items.exploration?.bag).toContainEqual({ itemId: hp, quantity: 2, origin: "acquired" });
    expect(purchaseItem(bought.items, bought.balance, bought.offer, input, catalog).accepted).toBe(false);
    expect(
      purchaseItem(
        JSON.parse(JSON.stringify(bought.items)),
        10,
        bought.offer,
        { ...input, expectedVersion: 2, quantity: 1 },
        catalog,
      ).accepted,
    ).toBe(false);
    expect(bought.items.exploration?.id).toBe(7);
  });
  it("不足金額・在庫・個数・場所の不適合を拒否する", () => {
    expect(purchaseItem(depart("town"), 19, offer, input, catalog).accepted).toBe(false);
    expect(purchaseItem(depart("town"), 30, { ...offer, stock: 1 }, input, catalog).accepted).toBe(false);
    expect(purchaseItem(depart("town"), 30, offer, { ...input, quantity: -1 }, catalog).accepted).toBe(false);
    expect(purchaseItem(depart(), 30, offer, input, catalog).accepted).toBe(false);
    expect(purchaseItem(home(), 30, offer, input, catalog).accepted).toBe(false);
  });
});
