import { describe, expect, it } from "vitest";
import { mentalFatigueDefinition as tuning } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import {
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  createBattleState,
  performBasicAttackAndAdvanceToAllyInput,
  performBattleSkillAndAdvanceToAllyInput,
} from "./battle";
import { initialLearnedSkills, type SkillCatalog } from "./skills";
import { healthyStatus } from "./status";

function start(overrides: Partial<BattleCombatantDefinition> = {}) {
  return advanceBattleToNextAllyInput(
    createBattleState([
      {
        id: "player",
        team: "ally",
        speed: 100,
        hp: 20,
        attackPower: 8,
        mentalFatigue: 100,
        learnedSkills: initialLearnedSkills(skillCatalog, "player"),
        ...overrides,
      },
      { id: "friend", team: "ally", speed: 1, hp: 5, maxHp: 20, attackPower: 0 },
      { id: "dead", team: "ally", speed: 1, hp: 0, maxHp: 20, attackPower: 0 },
      { id: "enemy", team: "enemy", speed: 40, hp: 200, attackPower: 0 },
    ]),
  ).state;
}
function use(
  state: ReturnType<typeof start>,
  target = "enemy",
  id = "test-strike",
  catalog: SkillCatalog = skillCatalog,
  time = state.logicalTime,
) {
  return performBattleSkillAndAdvanceToAllyInput(state, "player", target, id, time, catalog, tuning);
}
describe("公開スキル使用操作", () => {
  it("使用前100の倍率で16を8に減衰し、次の使用から104を参照する", () => {
    const first = use(start());
    if (!first.accepted) throw new Error(first.reason);
    expect(first.events[0]).toMatchObject({ type: "skill", amount: 8, fatigueBefore: 100, fatigueAfter: 104 });
    expect(first.state.combatants.find((member) => member.id === "enemy")?.hp).toBe(192);
    const second = use(first.state);
    if (!second.accepted) throw new Error(second.reason);
    expect(second.events[0]).toMatchObject({ fatigueBefore: 104, fatigueAfter: 108 });
    expect(second.state.combatants.find((member) => member.id === "enemy")?.hp).toBeCloseTo(184.15686274509804, 12);
    expect(first.state.combatants.find((member) => member.id === "player")?.status).toEqual({
      ...healthyStatus(),
      physicalFatigue: 4,
    });
  });
  it("回復の対象は自分を含む生存味方、上限でクランプしても疲労は一度加算する", () => {
    const ally = use(start(), "friend", "test-heal");
    if (!ally.accepted) throw new Error(ally.reason);
    expect(ally.state.combatants.find((member) => member.id === "friend")?.hp).toBe(14);
    const self = use(start(), "player", "test-heal");
    if (!self.accepted) throw new Error(self.reason);
    expect(self.events[0]).toMatchObject({ amount: 0, fatigueAfter: 103 });
    expect(self.state.combatants.find((member) => member.id === "player")?.hp).toBe(19);
    expect(use(start(), "dead", "test-heal")).toMatchObject({ accepted: false, reason: "target-is-defeated" });
  });
  it("命中0でも有効使用は疲労と追加発症を処理し、命中乱数だけを省く", () => {
    const state = start({ hitRate: 0, status: { ...healthyStatus(), haze: 20 } });
    const result = use(state);
    if (!result.accepted) throw new Error(result.reason);
    expect(result.events[0]).toMatchObject({ hit: false, amount: 0, fatigueAfter: 104 });
    expect(result.state.randomState).toBe(1586005467);
    expect(result.events).toContainEqual({
      type: "symptom",
      actorId: "player",
      kind: "physicalFatigue",
      before: 0,
      after: 4,
    });
    expect(result.state.logicalTime).toBeGreaterThan(state.logicalTime);
  });
  it("対象違い・未習得・旧行動時刻・使用場面違いを拒否し、HP・疲労・時計・乱数を保持する", () => {
    const state = start();
    const branchOnly: SkillCatalog = {
      ...skillCatalog,
      skills: skillCatalog.skills.map((skill) =>
        skill.id === "test-strike" ? { ...skill, scenes: ["branch"] as const } : skill,
      ),
    };
    for (const result of [
      use(state, "friend"),
      use(state, "enemy", "test-heal"),
      use(state, "enemy", "test-strike-advanced"),
      use(state, "enemy", "test-strike", branchOnly),
      use(state, "enemy", "test-strike", skillCatalog, -1),
    ]) {
      expect(result.accepted).toBe(false);
      expect(result.state).toEqual(state);
    }
    const accepted = use(state);
    if (!accepted.accepted) throw new Error(accepted.reason);
    expect(use(accepted.state, "enemy", "test-strike", skillCatalog, state.logicalTime)).toMatchObject({
      accepted: false,
      reason: "action-not-current",
      state: accepted.state,
    });
  });
  it("攻撃スキルもseed1の既知値で命中・外れを決め、拒否では乱数を進めない", () => {
    let state = start({ hitRate: 0.5, status: { ...healthyStatus(), haze: 10 } });
    const first = use(state);
    if (!first.accepted) throw new Error(first.reason);
    expect(first.state.randomState).toBe(2165703038);
    expect(first.events[0]).toMatchObject({ hit: true, amount: 8, fatigueAfter: 104 });
    state = first.state;
    const second = use(state);
    if (!second.accepted) throw new Error(second.reason);
    expect(second.state.randomState).toBe(1587069247);
    expect(second.events[0]).toMatchObject({ hit: false, amount: 0, fatigueAfter: 108 });
    const third = use(second.state);
    if (!third.accepted) throw new Error(third.reason);
    expect(third.state.randomState).toBe(2388811721);
    expect(third.events[0]).toMatchObject({ hit: false, amount: 0, fatigueAfter: 112 });
    expect(use(third.state, "missing")).toMatchObject({ accepted: false, state: third.state });
  });
  it("疲労増加0のアクティブと通常攻撃は疲労倍率対象外", () => {
    const zero: SkillCatalog = {
      ...skillCatalog,
      skills: skillCatalog.skills.map((skill) =>
        skill.id === "test-strike" ? { ...skill, mentalFatigueIncrease: 0 } : skill,
      ),
    };
    const result = use(start(), "enemy", "test-strike", zero);
    if (!result.accepted) throw new Error(result.reason);
    expect(result.events[0]).toMatchObject({ amount: 16, fatigueAfter: 100 });
    const basic = performBasicAttackAndAdvanceToAllyInput(start(), "player", "enemy");
    if (!basic.accepted) throw new Error(basic.reason);
    expect(basic.events[0]).toMatchObject({ type: "attack", damage: 8 });
    expect(basic.state.combatants[0].mentalFatigue).toBe(100);
  });
});
