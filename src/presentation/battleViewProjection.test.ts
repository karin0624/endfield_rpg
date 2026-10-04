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
import { createItemState, packItems } from "../game/items";
import { useBattleRecoveryItem } from "../game/itemUse";
import { createParty, getPartyCombatants, setPartySlot } from "../game/party";
import type { SkillCatalog } from "../game/skills";
import { healthyStatus } from "../game/status";
import { type BattleInput, confirmBattleAction, createBattleModel, reduceBattleModel } from "./battleModel";
import { projectBattleView } from "./battleViewProjection";

function input(enemyHp = 20): BattleInput {
  return {
    battle: advanceBattleToNextAllyInput(
      createBattleState([
        {
          id: "player",
          team: "ally",
          speed: 100,
          hp: 10,
          maxHp: 30,
          attackPower: 8,
          learnedSkills: [{ skillId: "test-heal", type: "active", origin: "initial", acquisition: "initial" }],
        },
        { id: "slime", team: "enemy", speed: 40, hp: enemyHp, attackPower: 4 },
      ]),
    ).state,
    basicAttack: true,
    rules: { catalog: skillCatalog, fatigue: mentalFatigueDefinition },
    items: true,
    itemCount: 2,
    enemyDepths: [{ id: "slime", depth: 2 }],
  };
}
function ready(value: BattleInput) {
  if (!value.battle) throw new Error("戦闘が必要です");
  return reduceBattleModel(createBattleModel({ before: value.battle, after: value.battle, events: [] }, 0), value, {
    type: "scene-ready",
    owner: 0,
  }).state;
}

describe("確定した戦闘結果からの画面投影", () => {
  it.each([
    [3, [11, 25, 100, 122, 150], [14, 89, 111, 139, 189]],
    [4, [11, 25, 43, 100, 122], [14, 32, 89, 111, 139]],
  ] as const)(
    "%i人の実編成を戦闘へ渡し、控えを描かず現在actor・次選択・行動順を投影する",
    (count, firstTicks, nextTicks) => {
      const definitions = [
        { id: "player", name: "Player", speed: 100 },
        { id: "gilberta", name: "Ally2", speed: 90 },
        { id: "third", name: "Ally3", speed: 80 },
        { id: "blocked", name: "Blocked", speed: 70 },
        { id: "reserve", name: "Reserve", speed: 60 },
      ].map((entry) => ({ ...entry, maxHp: 30, attackPower: 8 }));
      const catalog: SkillCatalog = {
        ...skillCatalog,
        characters: definitions.map(({ id }) => ({
          characterId: id,
          poolId: "test-shared",
          initialSkillIds:
            id === "player"
              ? ["test-strike", "test-heal", "test-strength"]
              : id === "gilberta"
                ? ["test-heal"]
                : ["test-strike"],
        })),
      };
      let party = createParty(
        definitions,
        definitions.map(({ id }) => id),
      );
      for (const [slot, id] of [
        [1, "gilberta"],
        [2, "third"],
        ...(count === 4 ? [[3, "blocked"] as const] : []),
      ] as const) {
        const assigned = setPartySlot(party, slot, id);
        if (!assigned.accepted) throw new Error(assigned.reason);
        party = assigned.state;
      }
      const enemies = ["slime", "slime-2", "third-enemy"].map((id) => ({
        id,
        team: "enemy" as const,
        hp: 14,
        speed: 1,
        attackPower: 0,
      }));
      const battle = advanceBattleToNextAllyInput(
        createBattleState([...getPartyCombatants(party, definitions, catalog), ...enemies]),
      ).state;
      const value: BattleInput = {
        battle,
        basicAttack: false,
        rules: { catalog, fatigue: mentalFatigueDefinition },
        items: false,
        itemCount: 0,
        enemyDepths: [
          { id: "slime", depth: 5 },
          { id: "slime-2", depth: 4 },
          { id: "third-enemy", depth: 3 },
        ],
      };
      const before = structuredClone(value);
      let model = ready(value);
      const names = Object.fromEntries(definitions.map(({ id, name }) => [id, name]));
      const frame = projectBattleView(model, value, { names });
      expect(frame.allies.map(({ name }) => name)).toEqual(
        count === 3
          ? ["Player", "Ally2", "Ally3（仮表示）"]
          : ["Player", "Ally2", "Ally3（仮表示）", "Blocked（仮表示）"],
      );
      expect(frame.queue[0]).toMatchObject({ id: "player", current: true, name: "Player" });
      expect(frame.queue.slice(1).map(({ ticks }) => ticks)).toEqual(firstTicks);
      for (let activation = 0; activation < 3; activation++) {
        model = reduceBattleModel(model, value, { type: "select-enemy", id: "third-enemy" }).state;
        expect(projectBattleView(model, value).enemies.find(({ id }) => id === "third-enemy")?.pressed).toBe(true);
      }
      model = reduceBattleModel(model, value, { type: "open-skills" }).state;
      expect(projectBattleView(model, value).skills.choices.map(({ text }) => text)).toEqual([
        "検証用攻撃",
        "検証用回復",
      ]);
      model = reduceBattleModel(model, value, { type: "select-skill", id: "test-strike" }).state;
      const command = reduceBattleModel(model, value, { type: "use-skill" }).command;
      expect(command).toEqual({ type: "skill", actorId: "player", targetId: "third-enemy", skillId: "test-strike" });
      const result = performBattleSkillAndAdvanceToAllyInput(
        battle,
        "player",
        "third-enemy",
        "test-strike",
        catalog,
        mentalFatigueDefinition,
      );
      if (!result.accepted) throw new Error(result.reason);
      const current = { ...value, battle: result.state };
      model = confirmBattleAction(model, current, {
        accepted: true,
        record: { before: battle, after: result.state, events: result.events },
      });
      model = reduceBattleModel(model, current, { type: "playback", event: { type: "skip" } }).state;
      const next = projectBattleView(model, current, { names });
      expect(next.allies.find(({ active }) => active)?.id).toBe("gilberta");
      expect(next.enemies.find(({ id }) => id === "third-enemy")).toMatchObject({ visible: false, hp: "0 / 14" });
      expect(next.enemies.find(({ id }) => id === "slime-2")).toMatchObject({ visible: true, pressed: true });
      expect(next.queue[0]).toMatchObject({ id: "gilberta", current: true });
      expect(next.queue.slice(1).map(({ ticks }) => ticks)).toEqual(nextTicks);
      model = reduceBattleModel(model, current, { type: "open-skills" }).state;
      expect(projectBattleView(model, current).skills.choices.map(({ text }) => text)).toEqual(["検証用回復"]);
      expect(value).toEqual(before);
      const unavailable = advanceBattleToNextAllyInput(
        createBattleState([
          ...getPartyCombatants(party, definitions, catalog).map((member) =>
            member.id === "third"
              ? { ...member, hp: 0 }
              : member.id === "blocked"
                ? { ...member, status: { ...healthyStatus(), incapacityRecoverySteps: 6 } }
                : member,
          ),
          ...enemies,
        ]),
      ).state;
      const unavailableInput = { ...value, battle: unavailable };
      const unavailableFrame = projectBattleView(ready(unavailableInput), unavailableInput);
      expect(unavailableFrame.queue.some(({ id }) => id === "third" || id === "blocked")).toBe(false);
      expect(unavailableFrame.allies.find(({ id }) => id === "third")).toMatchObject({ defeated: true, hp: "0" });
      if (count === 4)
        expect(unavailableFrame.allies.find(({ id }) => id === "blocked")).toMatchObject({
          defeated: true,
          hp: "30",
          symptoms: [{ kind: "incapacity" }],
        });
    },
  );
  it("別の味方を選ぶ回復draftと物品取消を表示し、確定した回復までHPを変えない", () => {
    const battle = advanceBattleToNextAllyInput(
      createBattleState([
        {
          id: "player",
          team: "ally",
          speed: 100,
          hp: 10,
          maxHp: 30,
          attackPower: 8,
          learnedSkills: [
            { skillId: "test-heal", type: "active", origin: "initial", acquisition: "initial" },
            { skillId: "test-strike", type: "active", origin: "initial", acquisition: "initial" },
            { skillId: "test-strength", type: "passive", origin: "initial", acquisition: "initial", rank: 1 },
          ],
        },
        { id: "gilberta", team: "ally", speed: 90, hp: 4, maxHp: 30, attackPower: 6 },
        { id: "reserve", team: "ally", speed: 80, hp: 0, maxHp: 30, attackPower: 6 },
        { id: "slime", team: "enemy", speed: 40, hp: 40, attackPower: 4 },
      ]),
    ).state;
    const value = { ...input(), battle };
    const untouched = structuredClone(value);
    let model = reduceBattleModel(ready(value), value, { type: "open-skills" }).state;
    expect(projectBattleView(model, value).skills.choices.map(({ text }) => text)).toEqual([
      "検証用回復",
      "検証用攻撃",
    ]);
    model = reduceBattleModel(model, value, { type: "select-skill", id: "test-heal" }).state;
    model = reduceBattleModel(model, value, { type: "select-ally", id: "gilberta" }).state;
    expect(projectBattleView(model, value).skills).toMatchObject({
      allyTargetId: "gilberta",
      allyTargetVisible: true,
      useEnabled: true,
      allies: [
        { id: "player", text: "ロッシ · HP 10 / 30" },
        { id: "gilberta", text: "ギルベルタ · HP 4 / 30" },
      ],
    });
    expect(projectBattleView(model, value).skills.preview).toContain("予測回復量 23（倍率 1）");
    expect(reduceBattleModel(model, value, { type: "select-enemy", id: "slime" }).handled).toBe(false);
    model = reduceBattleModel(model, value, { type: "open-item" }).state;
    model = reduceBattleModel(model, value, { type: "select-item-target", id: "reserve" }).state;
    expect(projectBattleView(model, value).items).toMatchObject({
      open: true,
      targetId: "reserve",
      preview: "この対象には使用できません。",
      useEnabled: false,
    });
    expect(projectBattleView(model, value).allies.find(({ id }) => id === "reserve")).toMatchObject({
      name: "reserve（仮表示）",
      defeated: true,
      symptoms: [{ kind: "incapacity" }],
    });
    model = reduceBattleModel(model, value, { type: "select-item-target", id: "gilberta" }).state;
    expect(projectBattleView(model, value).items).toMatchObject({
      preview: "回復見込み +8 HP · 残り2個",
      useEnabled: true,
    });
    model = reduceBattleModel(model, value, { type: "key", key: "Escape", shift: false }).state;
    expect(projectBattleView(model, value)).toMatchObject({
      focus: { kind: "item" },
      items: { open: false },
      skills: { allyTargetId: "gilberta", visible: true },
    });
    const result = performBattleSkillAndAdvanceToAllyInput(
      battle,
      "player",
      "gilberta",
      "test-heal",
      skillCatalog,
      mentalFatigueDefinition,
    );
    if (!result.accepted) throw new Error(result.reason);
    const current = { ...value, battle: result.state };
    model = confirmBattleAction(model, current, {
      accepted: true,
      record: { before: battle, after: result.state, events: result.events },
    });
    expect(projectBattleView(model, current).allies.find(({ id }) => id === "gilberta")?.hp).toBe("4");
    model = reduceBattleModel(model, current, { type: "playback", event: { type: "advance", elapsedMs: 260 } }).state;
    expect(projectBattleView(model, current).allies.find(({ id }) => id === "gilberta")?.hp).toBe("27");
    expect(projectBattleView(model, current).announcement).toBe("ロッシ · 検証用回復：ギルベルタ 23 回復 · 1発目");
    expect(value).toEqual(untouched);
  });

  it("全体多段の対象・予測・各着弾・確定summaryを表示し、敵全体選択では単体markerを描かない", () => {
    const catalog: SkillCatalog = {
      ...skillCatalog,
      skills: [
        ...skillCatalog.skills,
        {
          id: "all",
          name: "全体連撃",
          description: "敵全体へ3発",
          tier: "normal",
          type: "active",
          effect: { type: "damage", amount: 5, scaling: { stat: "attackPower", coefficient: 0 }, hitCount: 3 },
          mentalFatigueIncrease: 4,
          scenes: ["battle"],
          target: "all-enemies",
        },
      ],
    };
    const battle = advanceBattleToNextAllyInput(
      createBattleState([
        {
          id: "player",
          team: "ally",
          speed: 100,
          hp: 20,
          attackPower: 8,
          learnedSkills: [{ skillId: "all", type: "active", origin: "initial", acquisition: "initial" }],
        },
        { id: "slime", team: "enemy", speed: 40, hp: 2, attackPower: 4 },
        { id: "slime-2", team: "enemy", speed: 35, hp: 10, attackPower: 4 },
      ]),
    ).state;
    const value = { ...input(), battle, basicAttack: false, rules: { catalog, fatigue: mentalFatigueDefinition } };
    let model = reduceBattleModel(ready(value), value, { type: "open-skills" }).state;
    model = reduceBattleModel(model, value, { type: "select-skill", id: "all" }).state;
    expect(projectBattleView(model, value)).toMatchObject({
      markerId: null,
      enemies: [
        { pressed: true, disabled: true },
        { pressed: true, disabled: true },
      ],
      skills: {
        preview:
          "敵全体へ3発 予測ダメージ 5（倍率 1） · 使用後疲労 +4。命中・HP上限により実効果は変わります。 1体・1発あたり 5 × 3回（撃破時は打切り）。 対象：生存中の敵全体（スライム A、スライム B）",
      },
    });
    expect(reduceBattleModel(model, value, { type: "use-skill" }).command).toEqual({
      type: "skill",
      actorId: "player",
      targetId: null,
      skillId: "all",
    });
    const result = performBattleSkillAndAdvanceToAllyInput(
      battle,
      "player",
      null,
      "all",
      catalog,
      mentalFatigueDefinition,
    );
    if (!result.accepted) throw new Error(result.reason);
    const current = { ...value, battle: result.state };
    model = confirmBattleAction(model, current, {
      accepted: true,
      record: { before: battle, after: result.state, events: result.events },
    });
    model = reduceBattleModel(model, current, { type: "playback", event: { type: "advance", elapsedMs: 1640 } }).state;
    expect(projectBattleView(model, current).announcement).toBe("ロッシ · 全体連撃：スライム B −5 · 1発目");
    expect(projectBattleView(model, current).enemies.map(({ hp }) => hp)).toEqual(["0 / 2", "5 / 10"]);
    model = reduceBattleModel(model, current, { type: "playback", event: { type: "skip" } }).state;
    expect(projectBattleView(model, current)).toMatchObject({
      result: { visible: true },
      summary: {
        text: "全体連撃：スライム A 1発目 2ダメージ · スライム B 1発目 5ダメージ · スライム B 2発目 5ダメージ · 精神疲労 0 → 4",
      },
    });
  });

  it("回復→負荷確定→発症の最大HP clamp→敵攻撃を確定値どおりに表示する", () => {
    const battle = advanceBattleToNextAllyInput(
      createBattleState(
        [
          {
            id: "player",
            team: "ally",
            speed: 100,
            hp: 50,
            maxHp: 200,
            attackPower: 8,
            mentalFatigue: 20,
            status: { physicalFatigue: 100, haze: 0, incapacityRecoverySteps: null },
            learnedSkills: [{ skillId: "test-heal", type: "active", origin: "initial", acquisition: "initial" }],
          },
          { id: "slime", team: "enemy", speed: 90, hp: 40, attackPower: 4 },
        ],
        1,
      ),
    ).state;
    const catalog: SkillCatalog = {
      ...skillCatalog,
      skills: skillCatalog.skills.map((skill) =>
        skill.id === "test-heal" ? { ...skill, mentalFatigueIncrease: 20 } : skill,
      ),
    };
    const result = performBattleSkillAndAdvanceToAllyInput(
      battle,
      "player",
      "player",
      "test-heal",
      catalog,
      mentalFatigueDefinition,
    );
    if (!result.accepted) throw new Error(result.reason);
    const value = { ...input(), battle: result.state, rules: { catalog, fatigue: mentalFatigueDefinition } };
    let model = reduceBattleModel(
      createBattleModel({ before: battle, after: result.state, events: result.events }, 0),
      value,
      { type: "scene-ready", owner: 0 },
    ).state;
    model = reduceBattleModel(model, value, { type: "playback", event: { type: "advance", elapsedMs: 840 } }).state;
    const frame = projectBattleView(model, value);
    expect(frame.announcement).toBe("ロッシの肉体疲労：100 → 120（重度）");
    expect(frame.allies[0]).toMatchObject({ hp: "90", maximum: 90 });
    model = reduceBattleModel(model, value, { type: "toggle-symptom", id: "player", symptom: "physicalFatigue" }).state;
    expect(projectBattleView(model, value).allies[0].symptoms[0].open).toBe(true);
    model = reduceBattleModel(model, value, { type: "toggle-symptom", id: "player", symptom: "physicalFatigue" }).state;
    expect(projectBattleView(model, value).allies[0].symptoms[0].open).toBe(false);
    model = reduceBattleModel(model, value, { type: "playback", event: { type: "advance", elapsedMs: 920 } }).state;
    expect(projectBattleView(model, value)).toMatchObject({
      announcement: "スライム A · 通常攻撃：ロッシ −4",
      allies: [{ hp: "86" }],
    });
  });
  it("失敗後の有効な攻撃で案内を更新し、着弾量と退場完了の順に読み上げる", () => {
    const before = input(5);
    if (!before.battle) throw new Error("戦闘が必要です");
    const result = performBasicAttackAndAdvanceToAllyInput(before.battle, "player", "slime");
    if (!result.accepted) throw new Error(result.reason);
    const current = { ...before, battle: result.state };
    let model = confirmBattleAction(ready(before), before, { accepted: false, reason: "invalid-target" });
    expect(projectBattleView(model, before).announcement).toBe("使用できませんでした：invalid-target");
    model = confirmBattleAction(model, current, {
      accepted: true,
      record: { before: before.battle, after: result.state, events: result.events },
    });
    expect(projectBattleView(model, current)).toMatchObject({
      announcement: "対象：スライム A。スキルを選択します。敵をクリックすると対象を切り替えます。",
      enemies: [{ hp: "5 / 5", visible: true }],
    });
    model = reduceBattleModel(model, current, { type: "playback", event: { type: "advance", elapsedMs: 260 } }).state;
    expect(projectBattleView(model, current)).toMatchObject({
      announcement: "ロッシ · 通常攻撃：スライム A −8",
      enemies: [{ hp: "0 / 5", visible: true }],
    });
    model = reduceBattleModel(model, current, { type: "playback", event: { type: "advance", elapsedMs: 640 } }).state;
    expect(projectBattleView(model, current)).toMatchObject({
      announcement: "ロッシ · 通常攻撃：スライム A −8",
      toast: { text: "ロッシ · 通常攻撃 → スライム A" },
      enemies: [{ visible: true, defeated: true }],
    });
    model = reduceBattleModel(model, current, { type: "playback", event: { type: "advance", elapsedMs: 180 } }).state;
    expect(projectBattleView(model, current)).toMatchObject({
      announcement: "スライム Aは戦闘不能になった",
      enemies: [{ visible: false }],
    });
  });

  it("回復スキル・物品の確定回復量と所持数を表示し、表示でルールを再実行しない", () => {
    const before = input();
    if (!before.battle || !before.rules) throw new Error("戦闘が必要です");
    const untouched = structuredClone(before);
    const result = performBattleSkillAndAdvanceToAllyInput(
      before.battle,
      "player",
      "player",
      "test-heal",
      before.rules.catalog,
      before.rules.fatigue,
    );
    if (!result.accepted) throw new Error(result.reason);
    const current = { ...before, battle: result.state };
    let model = confirmBattleAction(ready(before), current, {
      accepted: true,
      record: { before: before.battle, after: result.state, events: result.events },
    });
    model = reduceBattleModel(model, current, { type: "playback", event: { type: "advance", elapsedMs: 260 } }).state;
    expect(projectBattleView(model, current)).toMatchObject({
      announcement: "ロッシ · 検証用回復：ロッシ 20 回復 · 1発目",
      allies: [{ hp: "30", symptoms: [] }],
    });
    const packed = packItems(
      createItemState([{ itemId: recoveryItemId, quantity: 2 }], itemCatalog),
      "dungeon",
      [{ itemId: recoveryItemId, quantity: 2 }],
      itemCatalog,
    );
    if (!packed.accepted) throw new Error(packed.reason);
    const used = useBattleRecoveryItem(
      packed.state,
      before.battle,
      { actorId: "player", targetId: "player", itemId: recoveryItemId },
      itemCatalog,
    );
    if (!used.accepted) throw new Error("使用失敗");
    const after = advanceBattleToNextAllyInput(used.battle);
    const itemInput = { ...before, battle: after.state, itemCount: 1 };
    let itemModel = confirmBattleAction(ready(before), itemInput, {
      accepted: true,
      record: { before: before.battle, after: after.state, events: [used.event, ...after.events] },
    });
    itemModel = reduceBattleModel(itemModel, itemInput, {
      type: "playback",
      event: { type: "advance", elapsedMs: 260 },
    }).state;
    expect(projectBattleView(itemModel, itemInput)).toMatchObject({
      announcement: "HP回復品：ロッシのHPを8回復 · 精神疲労は変化なし",
      allies: [{ hp: "18" }],
      items: { label: "物品（HP回復品 ×1）" },
    });
    expect(before).toEqual(untouched);
  });

  it("同じ幅・字体では症状の伸びからHP基準を守り、幅・字体・通常flowの変化は新しい実寸に合わせる", () => {
    const value = input();
    let model = ready(value);
    for (const [measure, expected] of [
      [
        { absolute: true, width: 800, font: "16px", height: 90 },
        { width: 800, font: "16px", height: 90 },
      ],
      [
        { absolute: true, width: 800, font: "16px", height: 130 },
        { width: 800, font: "16px", height: 90 },
      ],
      [
        { absolute: true, width: 390, font: "16px", height: 180 },
        { width: 390, font: "16px", height: 180 },
      ],
      [
        { absolute: true, width: 390, font: "32px", height: 240 },
        { width: 390, font: "32px", height: 240 },
      ],
      [{ absolute: false, width: 320, font: "32px", height: 270 }, null],
    ] as const) {
      model = reduceBattleModel(model, value, { type: "party-measured", measure }).state;
      expect(projectBattleView(model, value).partyAnchor).toEqual(expected);
    }
    expect(projectBattleView(model, value)).toMatchObject({
      skills: { triggerVisible: true, visible: false },
      items: { open: false },
    });
  });
});
