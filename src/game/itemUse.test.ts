import { describe, expect, it } from "vitest";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { itemTrials } from "../content/itemTrials";
import { advanceBattleToNextActor, type BattleCombatantDefinition, createBattleState } from "./battle";
import { createDungeonState, enterNextDungeonNode } from "./dungeon";
import { consumeBagItem, createItemState, packItems } from "./items";
import { previewRecoveryItem, useBattleRecoveryItem, useBranchRecoveryItem } from "./itemUse";
import { healthyStatus } from "./status";

const catalog = itemTrials.catalog;
const hp = "hp-recovery";
const ally: BattleCombatantDefinition = {
  id: "ally",
  team: "ally",
  maxHp: 20,
  hp: 5,
  speed: 100,
  attackPower: 8,
  mentalFatigue: 100,
  status: healthyStatus(),
};
const enemy: BattleCombatantDefinition = { id: "enemy", team: "enemy", maxHp: 20, hp: 20, speed: 90, attackPower: 5 };
function items() {
  const result = packItems(
    createItemState([{ itemId: hp, quantity: 2 }], catalog),
    "dungeon",
    [{ itemId: hp, quantity: 2 }],
    catalog,
  );
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
const input = {
  itemId: hp,
  targetId: "ally",
  actorId: "ally",
};
function battle(target: BattleCombatantDefinition = ally) {
  return advanceBattleToNextActor(createBattleState([ally, { ...target, id: "target" }, enemy], 23));
}
function dungeon() {
  return { ...createDungeonState(initialDungeon, initialAdventure, [ally], [], 23) };
}
describe("消耗品のHP回復", () => {
  it("疲労100でも8回復し、味方の1行動を消費する。次の味方手番は前の使用者を受理しない", () => {
    const start = battle();
    const result = useBattleRecoveryItem(items(), start, input, catalog);
    expect(result.accepted).toBe(true);
    expect(result.battle.combatants.find((c) => c.id === "ally")).toMatchObject({
      hp: 13,
      mentalFatigue: 100,
      nextActionTime: 200,
      status: healthyStatus(),
    });
    expect(result.battle.combatants.find((c) => c.id === "target")?.hp).toBe(5);
    expect(result.battle.currentActorId).toBe("target");
    expect(result.battle.randomState).toBe(23);
    expect(result.items.exploration?.bag).toEqual([{ itemId: hp, quantity: 1, origin: "carried" }]);
    const repeated = useBattleRecoveryItem(result.items, result.battle, input, catalog);
    expect(repeated.accepted).toBe(false);
    expect(repeated.battle.combatants.find((c) => c.id === "ally")?.hp).toBe(13);
    expect(repeated.items.exploration?.bag[0].quantity).toBe(1);
  });
  it("肉体疲労による有効上限10で止まり、症状と療養残りを変えない", () => {
    const target = { ...ally, hp: 7, status: { ...healthyStatus(), physicalFatigue: 100, haze: 50 } };
    const result = useBattleRecoveryItem(items(), battle(target), { ...input, targetId: "target" }, catalog);
    expect(result.accepted).toBe(true);
    expect(result.battle.combatants.find((c) => c.id === "target")).toMatchObject({
      hp: 10,
      mentalFatigue: 100,
      status: target.status,
    });
    if (result.accepted) expect(result.event.amount).toBe(3);
  });
  it.each([
    { ...ally, hp: 0 },
    { ...ally, hp: 20, status: { ...healthyStatus(), incapacityRecoverySteps: 6 } },
  ])("HP0またはHPが残る戦闘不能を回復・蘇生せず、個数も減らさない [%#]", (target) => {
    const result = useBattleRecoveryItem(items(), battle(target), { ...input, targetId: "target" }, catalog);
    expect(result.accepted).toBe(false);
    expect(result.items.exploration?.bag[0].quantity).toBe(2);
    expect(result.battle.currentActorId).toBe("ally");
  });
  it("敵・不存在・現在の手番でない使用者を拒否する", () => {
    for (const change of [{ targetId: "enemy" }, { targetId: "missing" }, { actorId: "target" }]) {
      const result = useBattleRecoveryItem(items(), battle(), { ...input, ...change }, catalog);
      expect(result.accepted).toBe(false);
      expect(result.items.exploration?.bag[0].quantity).toBe(2);
    }
  });
  it("分岐では位置・乱数・成長・疲労を進めず、同じ対象へ残る品物も使用できる", () => {
    const start = dungeon();
    const command = { ...input };
    const result = useBranchRecoveryItem(items(), start, command, catalog, initialDungeon);
    expect(result.accepted).toBe(true);
    expect(result.dungeon.party[0]).toMatchObject({ hp: 13, mentalFatigue: 100 });
    expect(result.dungeon.currentNodeId).toBe("entrance");
    expect(result.dungeon.randomState).toBe(23);
    expect(result.dungeon.resolvedNodeIds).toEqual(["entrance"]);
    const second = useBranchRecoveryItem(result.items, result.dungeon, command, catalog, initialDungeon);
    expect(second.accepted).toBe(true);
    expect(second.dungeon.party[0].hp).toBe(20);
    expect(second.items.exploration?.bag).toEqual([]);
    expect(second.dungeon.randomState).toBe(23);
    const entered = enterNextDungeonNode(start, "battle-a", initialDungeon, initialAdventure);
    if (!entered.accepted) throw new Error(entered.reason);
    expect(useBranchRecoveryItem(items(), entered.state, { ...command }, catalog, initialDungeon).accepted).toBe(false);
  });
  it("使い切った品物ではHPも手番も更新しない", () => {
    let stock = items();
    for (let i = 0; i < 2; i++) {
      const consumed = consumeBagItem(stock, hp, catalog);
      if (!consumed.accepted) throw new Error(consumed.reason);
      stock = consumed.state;
    }
    const result = useBattleRecoveryItem(stock, battle(), { ...input }, catalog);
    expect(result.accepted).toBe(false);
    expect(result.battle.currentActorId).toBe("ally");
    expect(result.battle.combatants.find((c) => c.id === "ally")?.hp).toBe(5);
  });
  it("満タン対象は実回復0で使用できず個数と手番を消費しない", () => {
    const result = useBattleRecoveryItem(
      items(),
      battle({ ...ally, hp: 20 }),
      { ...input, targetId: "target" },
      catalog,
    );
    expect(result.accepted).toBe(false);
    expect(result.items.exploration?.bag[0].quantity).toBe(2);
    expect(result.battle.currentActorId).toBe("ally");
    expect(previewRecoveryItem({ ...ally, hp: 20 }, hp, catalog)).toEqual({
      usable: false,
      amount: 0,
      reason: "no-recovery",
    });
  });
  it("対象選択へ有効上限を考慮した回復見込みと拒否理由を返す", () => {
    expect(previewRecoveryItem({ ...ally, hp: 17 }, hp, catalog)).toEqual({ usable: true, amount: 3 });
    expect(previewRecoveryItem({ ...ally, hp: 0 }, hp, catalog)).toEqual({
      usable: false,
      amount: 0,
      reason: "invalid-target",
    });
    expect(previewRecoveryItem(ally, "unknown", catalog)).toEqual({ usable: false, amount: 0, reason: "invalid-item" });
    const start = dungeon();
    const full = { ...start, party: [{ ...ally, hp: 20 }] };
    const result = useBranchRecoveryItem(items(), full, { ...input }, catalog, initialDungeon);
    expect(result.accepted).toBe(false);
    expect(result.items.exploration?.bag[0].quantity).toBe(2);
  });
  it("回復量の別案を注入できる", () => {
    const result = useBattleRecoveryItem(items(), battle(), input, [{ id: hp, kind: "consumable", hpRecovery: 3 }]);
    expect(result.accepted).toBe(true);
    expect(result.battle.combatants.find((c) => c.id === "ally")?.hp).toBe(8);
  });
});

describe("回復物品の入力境界と通知", () => {
  it("回復通知は実回復量・使用者・別の対象を識別し、分岐には使用者を付けない", () => {
    const result = useBattleRecoveryItem(
      items(),
      battle({ ...ally, hp: 17 }),
      { ...input, targetId: "target" },
      catalog,
    );
    expect(result.accepted).toBe(true);
    if (result.accepted)
      expect(result.event).toEqual({
        type: "item-recovery",
        itemId: hp,
        actorId: "ally",
        targetId: "target",
        amount: 3,
        targetHpBefore: 17,
        targetHpAfter: 20,
      });
    const branch = useBranchRecoveryItem(items(), dungeon(), { ...input }, catalog, initialDungeon);
    expect(branch.accepted).toBe(true);
    if (branch.accepted)
      expect(branch.event).toEqual({
        type: "item-recovery",
        itemId: hp,
        targetId: "ally",
        amount: 8,
        targetHpBefore: 5,
        targetHpAfter: 13,
      });
    for (const hpRecovery of [0, -1, Number.NaN, Infinity, -Infinity])
      expect(() => previewRecoveryItem(ally, hp, [{ id: hp, kind: "consumable", hpRecovery }])).toThrow();
  });
  it("敵手番と終了戦闘では味方を回復せず、行動・乱数・個数を保つ", () => {
    const enemyTurn = advanceBattleToNextActor(createBattleState([ally, { ...enemy, speed: 200 }], 23));
    const finished = createBattleState([ally, { ...enemy, hp: 0 }], 23);
    for (const start of [enemyTurn, finished]) {
      const stock = items();
      const before = structuredClone({ battle: start, items: stock });
      const result = useBattleRecoveryItem(
        stock,
        start,
        { ...input, actorId: start.currentActorId ?? "ally" },
        catalog,
      );
      expect(result.accepted).toBe(false);
      expect({ battle: result.battle, items: result.items }).toEqual(before);
    }
  });
  it("別経路・会話中の分岐使用を原子的に拒否する", () => {
    const start = dungeon();
    const entered = enterNextDungeonNode(start, "conversation-b", initialDungeon, initialAdventure);
    if (!entered.accepted) throw new Error(entered.reason);
    const cases = [
      {
        state: start,
        command: { ...input },
        route: { ...initialDungeon, id: "other-route" },
      },
      { state: entered.state, command: { ...input }, route: initialDungeon },
    ];
    for (const { state, command, route } of cases) {
      const stock = items();
      const before = structuredClone({ dungeon: state, items: stock });
      const result = useBranchRecoveryItem(stock, state, command, catalog, route);
      expect(result.accepted).toBe(false);
      expect({ dungeon: result.dungeon, items: result.items }).toEqual(before);
    }
  });
  it("分岐回復は同行者・非空フラグ・症状を保持する", () => {
    const start = {
      ...createDungeonState(
        initialDungeon,
        initialAdventure,
        [ally, { ...ally, id: "second", hp: 3, status: { ...healthyStatus(), haze: 20 } }],
        ["found-path"],
        23,
      ),
    };
    const snapshot = structuredClone(start);
    const result = useBranchRecoveryItem(items(), start, { ...input }, catalog, initialDungeon);
    expect(result.accepted).toBe(true);
    expect(result.dungeon).toEqual({ ...snapshot, party: [{ ...snapshot.party[0], hp: 13 }, snapshot.party[1]] });
    expect(result.items.exploration?.bag).toEqual([{ itemId: hp, quantity: 1, origin: "carried" }]);
    expect(start).toEqual(snapshot);
  });
});

it("戦闘不能の味方を手番として指定しても残る味方の手番と在庫を保つ", () => {
  const start = advanceBattleToNextActor(
    createBattleState(
      [{ ...ally, status: { ...healthyStatus(), incapacityRecoverySteps: 6 } }, { ...ally, id: "eligible" }, enemy],
      23,
    ),
  );
  const stock = items();
  const before = structuredClone({ battle: start, items: stock });
  expect(start.currentActorId).toBe("eligible");
  const result = useBattleRecoveryItem(stock, start, { ...input, targetId: "eligible" }, catalog);
  expect(result.accepted).toBe(false);
  expect({ battle: result.battle, items: result.items }).toEqual(before);
});
