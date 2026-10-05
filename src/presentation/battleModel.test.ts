import { describe, expect, it } from "vitest";
import { itemCatalog, recoveryItemId } from "../content/itemSettings";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import {
  advanceBattleToNextAllyInput,
  createBattleState,
  performBasicAttackAndAdvanceToAllyInput,
  performBattleSkillAndAdvanceToAllyInput,
} from "../game/battle";
import { bagItemQuantity, createItemState, packItems } from "../game/items";
import { useBattleRecoveryItem } from "../game/itemUse";
import { initialLearnedSkills } from "../game/skills";
import {
  type BattleInput,
  battleCanAct,
  battleItemUsable,
  confirmBattleAction,
  createBattleModel,
  reduceBattleModel,
} from "./battleModel";

function initial(hp = 50, enemyHp = 100): BattleInput {
  return {
    battle: advanceBattleToNextAllyInput(
      createBattleState([
        {
          id: "player",
          team: "ally",
          speed: 100,
          hp,
          maxHp: 100,
          attackPower: 8,
          learnedSkills: initialLearnedSkills(skillCatalog, "player"),
        },
        { id: "enemy", team: "enemy", speed: 90, hp: enemyHp, attackPower: 4 },
      ]),
    ).state,
    basicAttack: true,
    rules: { catalog: skillCatalog, fatigue: mentalFatigueDefinition },
    itemCount: 2,
    items: true,
    enemyDepths: [{ id: "enemy", depth: 2 }],
  };
}
function ready(input: BattleInput, speed: 0 | 1 | 2 = 1) {
  if (!input.battle) throw new Error("戦闘開始値が必要です");
  const model = createBattleModel({ before: input.battle, after: input.battle, events: [] }, 7, speed);
  return reduceBattleModel(model, input, { type: "scene-ready", owner: 7 }).state;
}

describe("戦闘画面の意味イベント", () => {
  it("命令を現在ゲームへ同期確定し、再生後の同じ攻撃も新しい状態で受理する", () => {
    let input = initial();
    let model = ready(input);
    const original = input;
    const before = structuredClone(input);
    for (const [enemyHp, allyHp] of [
      [92, 46],
      [84, 42],
    ]) {
      const command = reduceBattleModel(model, input, { type: "attack" }).command;
      expect(command).toEqual({ type: "attack", actorId: "player", targetId: "enemy" });
      if (command?.type !== "attack" || !input.battle) throw new Error("攻撃が必要です");
      const prior = input.battle;
      const committed = performBasicAttackAndAdvanceToAllyInput(prior, command.actorId, command.targetId);
      if (!committed.accepted) throw new Error(committed.reason);
      input = { ...input, battle: committed.state };
      model = confirmBattleAction(model, input, {
        accepted: true,
        record: { before: prior, after: committed.state, events: committed.events },
      });
      expect(input.battle?.combatants.map(({ hp }) => hp)).toEqual([allyHp, enemyHp]);
      expect(model.playback.display.combatants.find(({ id }) => id === "enemy")?.hp).toBe(enemyHp + 8);
      expect(reduceBattleModel(model, input, { type: "attack" })).toMatchObject({ handled: false, command: undefined });
      model = reduceBattleModel(model, input, { type: "playback", event: { type: "advance", elapsedMs: 2100 } }).state;
      expect(model.playback.phase).toBe("finished");
      expect(battleCanAct(model, input)).toBe(true);
    }
    expect(before.battle?.combatants.map(({ hp }) => hp)).toEqual([50, 100]);
    expect(before.battle?.logicalTime).toBe(100);
    expect(original).toEqual(before);
  });

  it("スキルの取消→再開、正当な対象選択、focusとTabをゲームを変更せず扱う", () => {
    const input = initial();
    const untouched = structuredClone(input);
    let model = ready(input);
    model = reduceBattleModel(model, input, { type: "open-skills" }).state;
    expect(model.focus).toEqual({ kind: "skill", id: "test-strike" });
    model = reduceBattleModel(model, input, { type: "select-skill", id: "test-heal" }).state;
    model = reduceBattleModel(model, input, { type: "focused", target: { kind: "ally-target" } }).state;
    model = reduceBattleModel(model, input, { type: "key", key: "Tab", shift: false }).state;
    expect(model.focus).toEqual({ kind: "use-skill" });
    model = reduceBattleModel(model, input, { type: "key", key: "Escape", shift: false }).state;
    expect(model.focus).toEqual({ kind: "skills" });
    model = reduceBattleModel(model, input, { type: "open-skills" }).state;
    for (let count = 0; count < 2; count++) {
      const selected = reduceBattleModel(model, input, { type: "select-skill", id: "test-heal" });
      expect(selected.handled).toBe(true);
      model = selected.state;
    }
    expect(reduceBattleModel(model, input, { type: "key", key: " ", shift: false }).handled).toBe(false);
    const command = reduceBattleModel(model, input, { type: "use-skill" }).command;
    expect(command).toEqual({ type: "skill", actorId: "player", targetId: "player", skillId: "test-heal" });
    if (command?.type !== "skill" || !input.battle || !input.rules) throw new Error("回復スキルが必要です");
    const result = performBattleSkillAndAdvanceToAllyInput(
      input.battle,
      command.actorId,
      command.targetId,
      command.skillId,
      input.rules.catalog,
      input.rules.fatigue,
    );
    if (!result.accepted) throw new Error(result.reason);
    expect(result.state.combatants.find(({ id }) => id === "player")).toMatchObject({ hp: 96, mentalFatigue: 3 });
    expect(input).toEqual(untouched);
  });

  it("物品dialogは下の選択を保って取消し、実消費後は次の使用とfocusを現在所持数から決める", () => {
    let input = initial(5);
    let model = ready(input, 0);
    model = reduceBattleModel(model, input, { type: "open-skills" }).state;
    model = reduceBattleModel(model, input, { type: "select-skill", id: "test-heal" }).state;
    model = reduceBattleModel(model, input, { type: "open-item" }).state;
    expect(model.focus).toEqual({ kind: "item-target" });
    model = reduceBattleModel(model, input, { type: "key", key: "Tab", shift: true }).state;
    expect(model.focus).toEqual({ kind: "item-back" });
    model = reduceBattleModel(model, input, { type: "cancel-item" }).state;
    expect(model.panel).toMatchObject({ kind: "skills", skillId: "test-heal" });
    model = reduceBattleModel(model, input, { type: "cancel-skills" }).state;
    const packed = packItems(
      createItemState([{ itemId: recoveryItemId, quantity: 2 }], itemCatalog),
      "dungeon",
      [{ itemId: recoveryItemId, quantity: 2 }],
      itemCatalog,
    );
    if (!packed.accepted) throw new Error(packed.reason);
    let items = packed.state;
    for (const [remaining, hp] of [
      [1, 9],
      [0, 13],
    ]) {
      model = reduceBattleModel(model, input, { type: "open-item" }).state;
      expect(battleItemUsable(model, input)).toBe(true);
      const command = reduceBattleModel(model, input, { type: "use-item" }).command;
      if (command?.type !== "item" || !input.battle) throw new Error("物品使用が必要です");
      const prior = input.battle;
      const used = useBattleRecoveryItem(items, prior, command, itemCatalog);
      if (!used.accepted) throw new Error("使用失敗");
      items = used.items;
      const next = advanceBattleToNextAllyInput(used.battle);
      input = { ...input, battle: next.state, itemCount: bagItemQuantity(items, recoveryItemId) };
      expect(input.itemCount).toBe(remaining);
      model = confirmBattleAction(model, input, {
        accepted: true,
        record: { before: prior, after: next.state, events: [used.event, ...next.events] },
      });
      expect(input.battle?.combatants.find(({ id }) => id === "player")?.hp).toBe(hp);
      expect(model.focus).toEqual({ kind: remaining ? "item" : "skills" });
    }
    expect(reduceBattleModel(model, input, { type: "open-item" }).handled).toBe(false);
  });

  it("全滅後にゲーム側の戦闘が無くても確定表示と実sceneを終了操作まで保持する", () => {
    const beforeInput = initial(1);
    let model = ready(beforeInput);
    if (!beforeInput.battle) throw new Error("開始値が必要です");
    const result = performBasicAttackAndAdvanceToAllyInput(beforeInput.battle, "player", "enemy");
    if (!result.accepted) throw new Error(result.reason);
    expect(result.state.outcome).toBe("defeat");
    const input = { ...beforeInput, battle: null };
    model = confirmBattleAction(model, input, {
      accepted: true,
      record: { before: beforeInput.battle, after: result.state, events: result.events },
    });
    expect(reduceBattleModel(model, input, { type: "finish" }).handled).toBe(false);
    model = reduceBattleModel(model, input, { type: "playback", event: { type: "skip" } }).state;
    expect(model.scene).toEqual({ owner: 7, status: "ready", reason: "" });
    expect(model.focus).toEqual({ kind: "finish" });
    expect(model.playback.display.combatants.find(({ id }) => id === "player")?.hp).toBe(0);
    expect(reduceBattleModel(model, input, { type: "finish" }).command).toEqual({ type: "finish" });
    model = reduceBattleModel(model, input, { type: "closed" }).state;
    expect(reduceBattleModel(model, input, { type: "scene-ready", owner: 7 }).handled).toBe(false);
    expect(
      reduceBattleModel(model, input, { type: "playback", event: { type: "advance", elapsedMs: 1000 } }).state,
    ).toEqual(model);
  });

  it("準備の失敗と退出は資源ownerで区別し、まだ準備中なら時間で演出を進めない", () => {
    const input = initial();
    if (!input.battle) throw new Error("開始値が必要です");
    const before = createBattleState([
      { id: "player", team: "ally", speed: 90, hp: 20, attackPower: 8 },
      { id: "enemy", team: "enemy", speed: 100, hp: 20, attackPower: 4 },
    ]);
    const opening = advanceBattleToNextAllyInput(before);
    const current = { ...input, battle: opening.state };
    const record = { before, after: opening.state, events: opening.events };
    const model = createBattleModel(record, 8);
    expect(reduceBattleModel(model, current, { type: "scene-ready", owner: 7 }).handled).toBe(false);
    expect(
      reduceBattleModel(model, current, { type: "playback", event: { type: "advance", elapsedMs: 500 } }).state,
    ).toEqual(model);
    const failed = reduceBattleModel(model, current, {
      type: "scene-error",
      owner: 8,
      reason: "素材を読み込めませんでした",
    }).state;
    expect(failed.scene.status).toBe("error");
    expect(reduceBattleModel(failed, current, { type: "attack" }).handled).toBe(false);
  });

  it("初回Tabは実表示順を選び、症状へ進み、非modalの終端では親画面へfocusを渡す", () => {
    const battle = advanceBattleToNextAllyInput(
      createBattleState([
        {
          id: "player",
          team: "ally",
          speed: 100,
          hp: 30,
          maxHp: 100,
          attackPower: 8,
          status: { physicalFatigue: 50, haze: 25, incapacityRecoverySteps: null },
          learnedSkills: initialLearnedSkills(skillCatalog, "player"),
        },
        { id: "enemy", team: "enemy", speed: 90, hp: 100, attackPower: 4 },
      ]),
    ).state;
    const input = { ...initial(), battle };
    const original = structuredClone(input);
    const shown = ready(input);
    expect(reduceBattleModel(shown, input, { type: "key", key: "Tab", shift: false }).state.focus).toEqual({
      kind: "enemy",
      id: "enemy",
    });
    expect(reduceBattleModel(shown, input, { type: "key", key: "Tab", shift: true }).state.focus).toEqual({
      kind: "symptom",
      id: "player",
      symptom: "haze",
    });
    let model = reduceBattleModel(shown, input, { type: "open-skills" }).state;
    model = reduceBattleModel(model, input, { type: "focused", target: { kind: "cancel-skill" } }).state;
    model = reduceBattleModel(model, input, { type: "key", key: "Tab", shift: false }).state;
    expect(model.focus).toEqual({ kind: "speed" });
    model = reduceBattleModel(model, input, { type: "key", key: "Tab", shift: false }).state;
    expect(model.focus).toEqual({ kind: "item" });
    model = reduceBattleModel(model, input, { type: "key", key: "Tab", shift: false }).state;
    expect(model.focus).toEqual({ kind: "symptom", id: "player", symptom: "physicalFatigue" });
    model = reduceBattleModel(model, input, { type: "toggle-symptom", id: "player", symptom: "physicalFatigue" }).state;
    expect(model.disclosures).toEqual([{ id: "player", symptom: "physicalFatigue" }]);
    model = reduceBattleModel(model, input, { type: "toggle-symptom", id: "player", symptom: "physicalFatigue" }).state;
    expect(model.disclosures).toEqual([]);
    model = reduceBattleModel(model, input, { type: "key", key: "Tab", shift: false }).state;
    expect(reduceBattleModel(model, input, { type: "key", key: "Tab", shift: false }).focusExit).toBe("next");
    expect(input).toEqual(original);
  });

  it("camera前方の実測対象だけを初期選択し、習得順がcatalog順と違っても候補順を保つ", () => {
    const input = initial();
    const hidden = { ...input, enemyDepths: [{ id: "enemy", depth: -1 }] };
    const unavailable = ready(hidden);
    expect(unavailable.selectedEnemyId).toBeNull();
    expect(reduceBattleModel(unavailable, hidden, { type: "attack" }).handled).toBe(false);
    const catalog = { ...skillCatalog, skills: [...skillCatalog.skills].reverse() };
    const reordered = { ...input, rules: { catalog, fatigue: mentalFatigueDefinition } };
    const selected = reduceBattleModel(ready(reordered), reordered, { type: "open-skills" }).state;
    expect(selected.focus).toEqual({ kind: "skill", id: "test-strike" });
    const modal = reduceBattleModel(ready(input), input, { type: "open-item" }).state;
    const neutral = { ...modal, focus: null };
    expect(reduceBattleModel(neutral, input, { type: "key", key: "Tab", shift: true }).state.focus).toEqual({
      kind: "item-back",
    });
    expect(reduceBattleModel(neutral, input, { type: "key", key: "Tab", shift: false }).state.focus).toEqual({
      kind: "item-target",
    });
  });
});
