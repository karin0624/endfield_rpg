import { describe, expect, it } from "vitest";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import {
  advanceBattleToNextAllyInput,
  type BattleState,
  createBattleState,
  performBasicAttackAndAdvanceToAllyInput,
  performBattleSkillAndAdvanceToAllyInput,
} from "../game/battle";
import { initialLearnedSkills, type SkillCatalog } from "../game/skills";
import { healthyStatus } from "../game/status";
import {
  type BattlePlayback,
  type ConfirmedBattleRecord,
  createBattlePlayback,
  projectBattleCue,
  reduceBattlePlayback,
} from "./battlePlayback";

const advance = (state: BattlePlayback, elapsedMs: number) =>
  reduceBattlePlayback(state, { type: "advance", elapsedMs });
const hp = (state: BattlePlayback, id: string) => state.display.combatants.find((member) => member.id === id)?.hp;
function normalRecord(enemyHp = 20): ConfirmedBattleRecord {
  const before = advanceBattleToNextAllyInput(
    createBattleState([
      { id: "player", team: "ally", speed: 100, hp: 20, attackPower: 8 },
      { id: "enemy", team: "enemy", speed: 90, hp: enemyHp, attackPower: 4 },
    ]),
  ).state;
  const result = performBasicAttackAndAdvanceToAllyInput(before, "player", "enemy");
  if (!result.accepted) throw new Error(result.reason);
  return { before, after: result.state, events: result.events };
}
const member = (state: BattleState, id: string) => {
  const result = state.combatants.find((member) => member.id === id);
  if (!result) throw new Error(id);
  return result;
};

describe("確定結果からの戦闘表示再生", () => {
  it("自己回復・一回の負荷・最大HP低下・敵被弾を確定HPの順で示し、未来値を借りない", () => {
    const catalog: SkillCatalog = {
      ...skillCatalog,
      skills: skillCatalog.skills.map((skill) =>
        skill.id === "test-heal" ? { ...skill, mentalFatigueIncrease: 20 } : skill,
      ),
    };
    const before = advanceBattleToNextAllyInput(
      createBattleState([
        {
          id: "player",
          team: "ally",
          speed: 100,
          hp: 50,
          maxHp: 200,
          attackPower: 8,
          mentalFatigue: 20,
          status: { ...healthyStatus(), physicalFatigue: 100 },
          learnedSkills: initialLearnedSkills(catalog, "player"),
        },
        { id: "enemy", team: "enemy", speed: 90, hp: 200, attackPower: 4 },
      ]),
    ).state;
    const result = performBattleSkillAndAdvanceToAllyInput(
      before,
      "player",
      "player",
      "test-heal",
      catalog,
      mentalFatigueDefinition,
    );
    if (!result.accepted) throw new Error(result.reason);
    const record = { before, after: result.state, events: result.events };
    const untouched = structuredClone(record);
    expect(result.events.map((event) => event.type)).toEqual(["skill", "skill-cost", "symptom", "attack"]);
    expect(result.events[0]).toMatchObject({
      targetHpBefore: 50,
      targetHpAfter: expect.closeTo(98.33333333333334, 12),
    });
    expect(result.events[2]).toMatchObject({ actorHpAfter: 90, statusAfter: { physicalFatigue: 120 } });
    expect(result.events[3]).toMatchObject({ targetHpBefore: 90, targetHpAfter: 86 });
    let state = createBattlePlayback(record);
    state = advance(state, 259);
    expect(hp(state, "player")).toBe(50);
    state = advance(state, 1);
    expect(hp(state, "player")).toBeCloseTo(98.33333333333334, 12);
    expect(member(state.display, "player")).toMatchObject({ mentalFatigue: 20, status: { physicalFatigue: 100 } });
    state = advance(state, 580);
    expect(hp(state, "player")).toBe(90);
    expect(member(state.display, "player")).toMatchObject({ mentalFatigue: 40, status: { physicalFatigue: 120 } });
    state = advance(state, 919);
    expect(hp(state, "player")).toBe(90);
    state = advance(state, 1);
    expect(hp(state, "player")).toBe(86);
    state = advance(state, 580);
    expect(state.phase).toBe("finished");
    expect(state.display).toEqual(result.state);
    expect(result.state).toMatchObject({ logicalTime: 200, randomState: 1586005467 });
    expect(record).toEqual(untouched);
  });

  it("全対象・全発の着弾、途中撃破の退場完了と一回の負荷を順に描く", () => {
    const skill = {
      id: "multi",
      name: "連続攻撃",
      description: "",
      type: "active",
      tier: "normal",
      scenes: ["battle"],
      target: "all-enemies",
      mentalFatigueIncrease: 100,
      effect: { type: "damage", amount: 0, scaling: { stat: "maxHp", coefficient: 0.1 }, hitCount: 3 },
    } as const;
    const catalog: SkillCatalog = { skills: [skill], characters: [], pools: [] };
    const before = advanceBattleToNextAllyInput(
      createBattleState([
        {
          id: "player",
          team: "ally",
          speed: 100,
          hp: 200,
          maxHp: 200,
          attackPower: 8,
          mentalFatigue: 300,
          learnedSkills: [{ skillId: "multi", type: "active", origin: "initial", acquisition: "initial" }],
        },
        { id: "z", team: "enemy", speed: 90, hp: 12, attackPower: 4 },
        { id: "a", team: "enemy", speed: 90, hp: 100, attackPower: 4 },
      ]),
    ).state;
    const result = performBattleSkillAndAdvanceToAllyInput(
      before,
      "player",
      null,
      "multi",
      catalog,
      mentalFatigueDefinition,
    );
    if (!result.accepted) throw new Error(result.reason);
    const record = { before, after: result.state, events: result.events };
    expect(
      result.events
        .filter((event) => event.type === "skill")
        .map((event) => [event.targetId, event.targetHpBefore, event.targetHpAfter]),
    ).toEqual([
      ["z", 12, 7],
      ["z", 7, 2],
      ["z", 2, 0],
      ["a", 100, 95],
      ["a", 95, 90],
      ["a", 90, 85],
    ]);
    expect(result.events.filter((event) => event.type === "skill-cost")).toEqual([
      { type: "skill-cost", actorId: "player", fatigueBefore: 300, fatigueAfter: 400 },
    ]);
    let state = createBattlePlayback(record);
    for (const expected of [7, 2, 0]) {
      state = advance(state, 260);
      expect(hp(state, "z")).toBe(expected);
      expect(state.visibleCombatantIds).toContain("z");
      expect(member(state.display, "player").mentalFatigue).toBe(300);
      state = advance(state, 580);
    }
    expect(member(state.display, "z")).toMatchObject({ isAlive: false, status: { incapacityRecoverySteps: 6 } });
    expect(state.visibleCombatantIds).toContain("z");
    state = advance(state, 239);
    expect(state.visibleCombatantIds).toContain("z");
    state = advance(state, 1);
    expect(state.visibleCombatantIds).not.toContain("z");
    state = advance(state, 300);
    for (const expected of [95, 90, 85]) {
      state = advance(state, 260);
      expect(hp(state, "a")).toBe(expected);
      expect(member(state.display, "player").mentalFatigue).toBe(300);
      state = advance(state, 580);
    }
    expect(member(state.display, "player")).toMatchObject({
      hp: 100,
      mentalFatigue: 400,
      status: { physicalFatigue: 100 },
    });
    expect(hp(state, "a")).toBe(85);
    state = advance(state, 1700);
    expect(state.phase).toBe("finished");
    expect(member(state.display, "player").hp).toBe(96);
    expect(state.display.randomState).toBe(1586005467);
  });

  it("速度変更は現在段階を保ち、段階を跨ぐCSS cueの進捗を飛ばさず次段階から速くする", () => {
    const record = normalRecord();
    let state = advance(createBattlePlayback(record), 280);
    expect(projectBattleCue(state)).toMatchObject({ phase: "impact", impactTimeMs: 20, numberTimeMs: 20 });
    state = reduceBattlePlayback(state, { type: "speed", speed: 2 });
    expect(projectBattleCue(state).impactTimeMs).toBe(20);
    state = advance(state, 59);
    expect(projectBattleCue(state)).toMatchObject({ phase: "impact", impactTimeMs: 79 });
    state = advance(state, 1);
    expect(projectBattleCue(state)).toMatchObject({ phase: "result", impactTimeMs: 80, numberTimeMs: 80 });
    state = advance(state, 10);
    expect(projectBattleCue(state)).toMatchObject({ phase: "result", impactTimeMs: 100, numberTimeMs: 100 });
    expect(hp(state, "enemy")).toBe(12);
    state = advance(state, 179);
    expect(projectBattleCue(state).phase).toBe("result");
    state = advance(state, 1);
    expect(projectBattleCue(state)).toMatchObject({ phase: "settle", numberTimeMs: 0, actorTimeMs: 460 });
    const unchanged = structuredClone(record);
    expect(reduceBattlePlayback(state, { type: "skip" }).display).toEqual(record.after);
    expect(record).toEqual(unchanged);
  });

  it("reduced motionは静止読み取りを保ち、省略・即時・取消はHP、時計、RNGを再実行しない", () => {
    const record = normalRecord(5);
    const before = structuredClone(record);
    let reduced = createBattlePlayback(record, 1, true);
    reduced = advance(reduced, 119);
    expect(projectBattleCue(reduced)).toMatchObject({ phase: "actor", motion: false });
    expect(hp(reduced, "enemy")).toBe(5);
    reduced = advance(reduced, 1);
    expect(projectBattleCue(reduced)).toMatchObject({ phase: "result", motion: false });
    expect(hp(reduced, "enemy")).toBe(0);
    reduced = advance(reduced, 380);
    expect(reduced.visibleCombatantIds).toContain("enemy");
    reduced = advance(reduced, 240);
    expect(reduced.visibleCombatantIds).not.toContain("enemy");
    reduced = advance(reduced, 600);
    expect(reduced.phase).toBe("finished");
    for (const state of [
      createBattlePlayback(record, 0),
      reduceBattlePlayback(createBattlePlayback(record), { type: "skip" }),
      reduceBattlePlayback(createBattlePlayback(record), { type: "speed", speed: 0 }),
    ]) {
      expect(state.phase).toBe("finished");
      expect(state.display).toEqual(record.after);
      expect(projectBattleCue(state).visible).toBe(false);
    }
    const closed = reduceBattlePlayback(advance(createBattlePlayback(record), 260), { type: "close" });
    expect(advance(closed, 10_000)).toEqual(closed);
    expect(reduceBattlePlayback(closed, { type: "skip" })).toEqual(closed);
    expect(record).toEqual(before);
  });

  it("敵の先行行動がない開始、motion変更と別表示への再作成を扱う", () => {
    const record = normalRecord();
    const opening = advanceBattleToNextAllyInput(
      createBattleState([
        { id: "player", team: "ally", speed: 100, hp: 20, attackPower: 8 },
        { id: "enemy", team: "enemy", speed: 90, hp: 20, attackPower: 4 },
      ]),
    );
    expect(opening.events).toEqual([]);
    const empty = createBattlePlayback({ before: opening.state, after: opening.state, events: opening.events });
    expect(empty.phase).toBe("finished");
    expect(advance(empty, 1000).display).toEqual(opening.state);
    const active = advance(createBattlePlayback(record, 2), 130);
    const still = reduceBattlePlayback(active, { type: "motion", reduced: true });
    expect(hp(still, "enemy")).toBe(12);
    expect(projectBattleCue(still)).toMatchObject({ phase: "impact", motion: false });
    expect(reduceBattlePlayback(still, { type: "motion", reduced: false }).display).toEqual(active.display);
    const fresh = createBattlePlayback(normalRecord());
    expect(hp(fresh, "enemy")).toBe(20);
    expect(projectBattleCue(fresh).phase).toBe("actor");
  });
});
