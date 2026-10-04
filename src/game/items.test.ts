import { describe, expect, it, vi } from "vitest";
import { itemRetentionPolicy, itemSettings, recoveryItemOffer } from "../content/itemSettings";
import { itemTrials } from "../content/itemTrials";
import { purchaseItem } from "./itemPurchase";
import { independentItemRetention } from "./itemRetention";
import {
  acquireImportantItem,
  bagItemQuantity,
  consumeBagItem,
  createItemState,
  type ItemResult,
  packItems,
  receiveItems,
  returnItems,
} from "./items";

const catalog = itemTrials.catalog;
const hp = "hp-recovery";
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
      destination,
      [
        { itemId: hp, quantity: 3 },
        { itemId: material, quantity: 2 },
      ],
      catalog,
    ),
  );
}
describe("物品の保管・探索・帰還", () => {
  it("選択数だけホームから移し、同品目の獲得分と持込み分を識別する", () => {
    const start = depart();
    expect(start.home).toEqual([
      { itemId: hp, quantity: 2 },
      { itemId: material, quantity: 1 },
    ]);
    const looted = accepted(receiveItems(start, [{ itemId: hp, quantity: 2 }], catalog));
    expect(looted.exploration?.bag).toEqual([
      { itemId: hp, quantity: 3, origin: "carried" },
      { itemId: material, quantity: 2, origin: "carried" },
      { itemId: hp, quantity: 2, origin: "acquired" },
    ]);
    const consumed = accepted(consumeBagItem(looted, hp, catalog));
    const back = returnItems(consumed, "cleared", 123);
    expect(back.accepted).toBe(true);
    expect(back.state.home).toEqual([
      { itemId: hp, quantity: 6 },
      { itemId: material, quantity: 3 },
    ]);
    expect(back.randomState).toBe(123);
    expect(back.lost).toEqual([]);
    expect(returnItems(back.state, "cleared", 123).accepted).toBe(false);
  });
  it.each(["defeat", "retreat"] as const)("%sは持込み消耗品・素材と獲得品を同じ注入抽選へ渡す", (outcome) => {
    const start = depart();
    const looted = accepted(receiveItems(start, [{ itemId: material, quantity: 2 }], catalog));
    const permanent = accepted(acquireImportantItem(looted, "trial-important", catalog));
    const policy = vi.fn(itemRetentionPolicy);
    const result = returnItems(permanent, outcome, 1, policy);
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
    expect(returnItems(restored, outcome, result.randomState, policy).accepted).toBe(false);
    expect(policy).toHaveBeenCalledExactlyOnceWith(
      [
        { itemId: hp, quantity: 3, origin: "carried" },
        { itemId: material, quantity: 2, origin: "carried" },
        { itemId: material, quantity: 2, origin: "acquired" },
      ],
      1,
      outcome,
    );
  });
  it("重要品は永続集合で重複せず、持込みも消費もできない", () => {
    const important = accepted(acquireImportantItem(home(), "trial-important", catalog));
    const before = structuredClone(important);
    const again = accepted(acquireImportantItem(important, "trial-important", catalog));
    expect(again).toEqual(before);
    expect(again.importantIds).toEqual(["trial-important"]);
    expect(packItems(again, "town", [{ itemId: "trial-important", quantity: 1 }], catalog).accepted).toBe(false);
    expect(consumeBagItem(depart(), "trial-important", catalog).accepted).toBe(false);
  });
  it("上限なしで持込みでき、重複行を合算して不足・不正数を拒否する", () => {
    const large = createItemState([{ itemId: hp, quantity: 10000 }], catalog);
    expect(packItems(large, "town", [{ itemId: hp, quantity: 10000 }], catalog).accepted).toBe(true);
    expect(
      packItems(
        home(),
        "town",
        [
          { itemId: hp, quantity: 3 },
          { itemId: hp, quantity: 3 },
        ],
        catalog,
      ).accepted,
    ).toBe(false);
    const combined = accepted(
      packItems(
        home(),
        "town",
        [
          { itemId: hp, quantity: 2 },
          { itemId: hp, quantity: 3 },
        ],
        catalog,
      ),
    );
    expect(combined.home).toEqual([{ itemId: material, quantity: 3 }]);
    expect(combined.exploration?.bag).toEqual([{ itemId: hp, quantity: 5, origin: "carried" }]);
    for (const quantity of [-1, 0, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(packItems(home(), "town", [{ itemId: hp, quantity }], catalog).accepted).toBe(false);
    expect(packItems(depart(), "town", [], catalog).accepted).toBe(false);
  });
  it("クリアは抽選せず、未決のロスト方針や不正な保持数を暗黙補完しない", () => {
    const start = depart();
    const policy = vi.fn(itemRetentionPolicy);
    expect(returnItems(start, "cleared", 1, policy).accepted).toBe(true);
    expect(policy).not.toHaveBeenCalled();
    expect(() => returnItems(start, "retreat", 1)).toThrow();
    expect(() => returnItems(start, "defeat", 1, () => ({ quantities: [4, 2], randomState: 1 }))).toThrow();
    expect(returnItems(home(), "defeat", 1, policy).accepted).toBe(false);
    expect(policy).not.toHaveBeenCalled();
  });
});
describe("注入価格による街探索中の購入", () => {
  const offer = recoveryItemOffer;
  const quantity = 2;
  it("金額・バッグを一度に更新し、次の購入を現在の残高で判断する", () => {
    const bought = purchaseItem(depart("town"), itemSettings.initialBalance, offer, quantity, catalog);
    expect(bought.accepted).toBe(true);
    expect(bought.balance).toBe(10);
    expect(bagItemQuantity(bought.items, hp)).toBe(5);
    expect(bought.items.exploration?.bag).toContainEqual({ itemId: hp, quantity: 2, origin: "acquired" });
    expect(purchaseItem(bought.items, bought.balance, bought.offer, quantity, catalog).accepted).toBe(false);
    expect(purchaseItem(JSON.parse(JSON.stringify(bought.items)), 10, bought.offer, 1, catalog).accepted).toBe(true);
  });
  it("不足金額・個数・場所の不適合を拒否する", () => {
    expect(purchaseItem(depart("town"), 19, offer, quantity, catalog).accepted).toBe(false);
    expect(purchaseItem(depart("town"), 30, offer, -1, catalog).accepted).toBe(false);
    expect(purchaseItem(depart(), 30, offer, quantity, catalog).accepted).toBe(false);
    expect(purchaseItem(home(), 30, offer, quantity, catalog).accepted).toBe(false);
  });
});

describe("承認済み保持抽選と購入上限なし", () => {
  it.each([
    [0.5 - 1 / 0x100000000, 0],
    [0.5, 0],
    [0.5 + 1 / 0x100000000, 1],
  ])("保持確率%sは乱数0.5との厳密な境界で1個の保持を決める", (probability, quantity) => {
    // (1664525 * 2782269413 + 1013904223) mod 2^32 = 2147483648.
    // This independent seed pins the draw to exactly 0.5, without using the RNG as an oracle.
    const bag = [{ itemId: hp, quantity: 1, origin: "carried" as const }];
    expect(independentItemRetention(probability)(bag, 2782269413, "defeat")).toEqual({
      quantities: [quantity],
      randomState: 2147483648,
    });
  });
  it("同じ品物は合計数で扱い、持込みを使い切ってから獲得分を使う", () => {
    let state = depart();
    state = accepted(receiveItems(state, [{ itemId: hp, quantity: 2 }], catalog));
    expect(bagItemQuantity(state, hp)).toBe(5);
    for (const [carried, acquired] of [
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ]) {
      state = accepted(consumeBagItem(state, hp, catalog));
      expect(state.exploration?.bag.filter((entry) => entry.itemId === hp)).toEqual([
        ...(carried ? [{ itemId: hp, quantity: carried, origin: "carried" }] : []),
        { itemId: hp, quantity: acquired, origin: "acquired" },
      ]);
    }
    expect(bagItemQuantity(state, hp)).toBe(1);
  });
  it("50%独立抽選は1個なら全保持と全損の両方があり、空バッグは乱数を進めない", () => {
    const bag = [{ itemId: hp, quantity: 1, origin: "carried" as const }];
    expect(itemRetentionPolicy(bag, 1, "defeat").quantities).toEqual([1]);
    expect(itemRetentionPolicy(bag, 1000, "retreat").quantities).toEqual([0]);
    expect(itemRetentionPolicy([], 7, "defeat")).toEqual({ quantities: [], randomState: 7 });
    expect(independentItemRetention(0)(bag, 1, "defeat").quantities).toEqual([0]);
    expect(independentItemRetention(1)(bag, 1, "defeat").quantities).toEqual([1]);
  });
  it("所持金が足りれば3個を超える購入を受理する", () => {
    const result = purchaseItem(depart("town"), 100, recoveryItemOffer, 10, catalog);
    expect(result.accepted).toBe(true);
    expect(result.balance).toBe(0);
    expect(bagItemQuantity(result.items, hp)).toBe(13);
  });
});

describe("物品APIの境界と原子的更新", () => {
  it("ホームの初期在庫と複製を保証し、不正な在庫定義を拒否する", () => {
    const source = [{ itemId: hp, quantity: 2 }];
    const state = createItemState(source, catalog);
    source[0].quantity = 99;
    expect(state).toEqual({ home: [{ itemId: hp, quantity: 2 }], importantIds: [], exploration: null });
    for (const quantity of [0, -1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => createItemState([{ itemId: hp, quantity }], catalog)).toThrow();
    for (const itemId of ["unknown", "trial-important"])
      expect(() => createItemState([{ itemId, quantity: 1 }], catalog)).toThrow();
    expect(() =>
      createItemState(
        [
          { itemId: hp, quantity: 1 },
          { itemId: hp, quantity: 2 },
        ],
        catalog,
      ),
    ).toThrow();
  });
  it("獲得分へ合算し、帰還後の次の探索でも新たな獲得分を受領する", () => {
    const source = depart();
    const before = structuredClone(source);
    const first = accepted(receiveItems(source, [{ itemId: hp, quantity: 10000 }], catalog));
    const second = accepted(receiveItems(first, [{ itemId: hp, quantity: 2 }], catalog));

    expect(second.exploration?.bag).toEqual([
      { itemId: hp, quantity: 3, origin: "carried" },
      { itemId: material, quantity: 2, origin: "carried" },
      { itemId: hp, quantity: 10002, origin: "acquired" },
    ]);
    const consumed = accepted(consumeBagItem(second, hp, catalog));

    const back = accepted(returnItems(consumed, "cleared", 123));

    expect(back.home).toEqual([
      { itemId: hp, quantity: 10006 },
      { itemId: material, quantity: 3 },
    ]);
    const next = accepted(packItems(back, "dungeon", [], catalog));

    const rewarded = accepted(receiveItems(next, [{ itemId: hp, quantity: 1 }], catalog));

    expect(rewarded.exploration).toEqual({
      destination: "dungeon",

      bag: [{ itemId: hp, quantity: 1, origin: "acquired" }],
    });
    expect(source).toEqual(before);
  });
  it("不正な獲得品・素材消費は全在庫を更新しない", () => {
    const start = depart();
    const before = structuredClone(start);
    const results = [
      receiveItems(
        start,
        [
          { itemId: hp, quantity: 1 },
          { itemId: "unknown", quantity: 1 },
        ],
        catalog,
      ),
      receiveItems(
        start,
        [
          { itemId: hp, quantity: 1 },
          { itemId: material, quantity: 0 },
        ],
        catalog,
      ),
      consumeBagItem(start, material, catalog),
      acquireImportantItem(start, hp, catalog),
      acquireImportantItem(start, "unknown", catalog),
    ];
    for (const result of results) {
      expect(result.accepted).toBe(false);
      expect(result.state).toEqual(before);
    }
    for (const quantity of [0, -1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        receiveItems(
          start,
          [
            { itemId: hp, quantity: 1 },
            { itemId: material, quantity },
          ],
          catalog,
        ),
      ).toEqual({ accepted: false, state: before, reason: "invalid-item" });
    }
    expect(start).toEqual(before);
    const atHome = home();
    const homeBefore = structuredClone(atHome);
    expect(receiveItems(atHome, [{ itemId: hp, quantity: 1 }], catalog)).toEqual({
      accepted: false,
      reason: "wrong-place",
      state: homeBefore,
    });
    expect(
      packItems(
        atHome,
        "town",
        [
          { itemId: hp, quantity: 3 },
          { itemId: hp, quantity: 3 },
        ],
        catalog,
      ),
    ).toEqual({ accepted: false, reason: "insufficient-stock", state: homeBefore });
    expect(atHome).toEqual(homeBefore);
    const important = accepted(acquireImportantItem(start, "trial-important", catalog));

    expect(accepted(acquireImportantItem(important, "trial-important", catalog))).toEqual(important);
  });
  it("保持方針へ公開バッグ・種・帰還理由を渡し、帰還後は抽選しない", () => {
    const state = depart();
    const snapshot = structuredClone(state);
    const policy = vi.fn(() => ({ quantities: [0, 2], randomState: 4294967295 }));
    const returned = returnItems(state, "retreat", 23, policy);
    expect(policy).toHaveBeenCalledExactlyOnceWith(
      [
        { itemId: hp, quantity: 3, origin: "carried" },
        { itemId: material, quantity: 2, origin: "carried" },
      ],
      23,
      "retreat",
    );
    const completed = structuredClone(returned.state);
    expect(returnItems(returned.state, "retreat", 4294967295, policy)).toEqual({
      accepted: false,
      reason: "wrong-place",
      state: completed,
      randomState: 4294967295,
    });
    expect(policy).toHaveBeenCalledTimes(1);
    expect(returned.randomState).toBe(4294967295);
    expect(returned.state.home).toEqual([
      { itemId: hp, quantity: 2 },
      { itemId: material, quantity: 3 },
    ]);
    expect(state).toEqual(snapshot);
    for (const output of [
      { quantities: [1], randomState: 0 },
      ...[-1, 0.5, Number.NaN, 4].map((quantity) => ({ quantities: [quantity, 1], randomState: 0 })),
      ...[-1, 0.5, Number.NaN, 4294967296].map((randomState) => ({ quantities: [1, 1], randomState })),
    ])
      expect(() => returnItems(state, "defeat", 23, () => output)).toThrow();
    expect(state).toEqual(snapshot);
    for (const probability of [-0.01, 1.01, Number.NaN, Infinity, -Infinity])
      expect(() => independentItemRetention(probability)).toThrow();
  });
  it("購入拒否は残高・所持・報酬を保ち、無料の再購入は現在の状態で受理する", () => {
    const state = depart("town");
    const before = structuredClone(state);
    for (const quantity of [0, -1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
      const result = purchaseItem(state, 30, recoveryItemOffer, quantity, catalog);
      expect(result).toEqual({ accepted: false, items: before, balance: 30, offer: recoveryItemOffer });
    }
    expect(purchaseItem(state, 0, recoveryItemOffer, 1, catalog)).toEqual({
      accepted: false,
      items: before,
      balance: 0,
      offer: recoveryItemOffer,
    });
    for (const value of [-1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => purchaseItem(state, value, recoveryItemOffer, 1, catalog)).toThrow();
      expect(() => purchaseItem(state, 30, { ...recoveryItemOffer, unitPrice: value }, 1, catalog)).toThrow();
    }
    const rewarded = accepted(receiveItems(state, [{ itemId: hp, quantity: 1 }], catalog));
    const freeOffer = { ...recoveryItemOffer, unitPrice: 0 };
    const bought = purchaseItem(rewarded, 0, freeOffer, 1, catalog);
    expect(bought.accepted).toBe(true);
    expect(bought.balance).toBe(0);

    expect(bought.items.exploration?.bag).toContainEqual({ itemId: hp, quantity: 2, origin: "acquired" });
    const boughtBefore = structuredClone(bought.items);
    const retry = purchaseItem(bought.items, 0, freeOffer, 1, catalog);
    expect(retry.accepted).toBe(true);
    expect(retry.balance).toBe(0);

    expect(retry.items.exploration?.bag).toContainEqual({ itemId: hp, quantity: 3, origin: "acquired" });
    expect(bought.items).toEqual(boughtBefore);
    expect(state).toEqual(before);
  });
});

it("各成功操作は元入力を変更せず、持込み・獲得・消費・帰還の実数量を更新する", () => {
  const source = home();
  const sourceBefore = structuredClone(source);
  const packed = accepted(packItems(source, "dungeon", [{ itemId: hp, quantity: 1 }], catalog));
  expect(source).toEqual(sourceBefore);

  const packedBefore = structuredClone(packed);
  const rewarded = accepted(receiveItems(packed, [{ itemId: hp, quantity: 2 }], catalog));
  expect(packed).toEqual(packedBefore);

  const rewardedBefore = structuredClone(rewarded);
  const consumed = accepted(consumeBagItem(rewarded, hp, catalog));
  expect(rewarded).toEqual(rewardedBefore);

  const consumedBefore = structuredClone(consumed);
  const returned = accepted(returnItems(consumed, "cleared", 1));
  expect(consumed).toEqual(consumedBefore);
  expect(returned).toEqual({
    home: [
      { itemId: hp, quantity: 6 },
      { itemId: material, quantity: 3 },
    ],
    importantIds: [],
    exploration: null,
  });
});
