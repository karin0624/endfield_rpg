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
    0,
    7,
    "dungeon",
    [{ itemId: hp, quantity: 2 }],
    catalog,
  );
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
const input = {
  expectedVersion: 1,
  explorationId: 7,
  itemId: hp,
  targetId: "ally",
  actorId: "ally",
  expectedActionTime: 100,
};
function battle(target: BattleCombatantDefinition = ally) {
  return advanceBattleToNextActor(createBattleState([ally, { ...target, id: "target" }, enemy], 23));
}
function dungeon() {
  return { ...createDungeonState(initialDungeon, initialAdventure, [ally], [], 23), expeditionActionId: 7 };
}
describe("消耗品のHP回復", () => {
  it("疲労100でも8回復し、味方の1行動を消費する。再送で消費・行動・乱数を重ねない", () => {
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
  it("敵・不存在・手番違い・古い探索/版の入力を拒否する", () => {
    for (const change of [
      { targetId: "enemy" },
      { targetId: "missing" },
      { actorId: "target" },
      { expectedActionTime: 99 },
      { explorationId: 8 },
      { expectedVersion: 0 },
    ]) {
      const result = useBattleRecoveryItem(items(), battle(), { ...input, ...change }, catalog);
      expect(result.accepted).toBe(false);
      expect(result.items.exploration?.bag[0].quantity).toBe(2);
    }
  });
  it("分岐では位置・乱数・成長・疲労を進めず1人を回復し、再送を拒否する", () => {
    const start = dungeon();
    const command = { ...input, expectedNodeId: start.currentNodeId };
    const result = useBranchRecoveryItem(items(), start, command, catalog, initialDungeon);
    expect(result.accepted).toBe(true);
    expect(result.dungeon.party[0]).toMatchObject({ hp: 13, mentalFatigue: 100 });
    expect(result.dungeon.currentNodeId).toBe("entrance");
    expect(result.dungeon.randomState).toBe(23);
    expect(result.dungeon.resolvedNodeIds).toEqual(["entrance"]);
    expect(useBranchRecoveryItem(result.items, result.dungeon, command, catalog, initialDungeon).accepted).toBe(false);
    const entered = enterNextDungeonNode(start, "battle-a", initialDungeon, initialAdventure);
    if (!entered.accepted) throw new Error(entered.reason);
    expect(
      useBranchRecoveryItem(items(), entered.state, { ...command, expectedNodeId: "battle-a" }, catalog, initialDungeon)
        .accepted,
    ).toBe(false);
  });
  it("使い切った品物ではHPも手番も更新しない", () => {
    let stock = items();
    for (let i = 0; i < 2; i++) {
      const consumed = consumeBagItem(stock, stock.version, hp, catalog);
      if (!consumed.accepted) throw new Error(consumed.reason);
      stock = consumed.state;
    }
    const result = useBattleRecoveryItem(stock, battle(), { ...input, expectedVersion: stock.version }, catalog);
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
    const result = useBranchRecoveryItem(
      items(),
      full,
      { ...input, expectedNodeId: full.currentNodeId },
      catalog,
      initialDungeon,
    );
    expect(result.accepted).toBe(false);
    expect(result.items.exploration?.bag[0].quantity).toBe(2);
  });
  it("回復量の別案を注入できる", () => {
    const result = useBattleRecoveryItem(items(), battle(), input, [{ id: hp, kind: "consumable", hpRecovery: 3 }]);
    expect(result.accepted).toBe(true);
    expect(result.battle.combatants.find((c) => c.id === "ally")?.hp).toBe(8);
  });
});
