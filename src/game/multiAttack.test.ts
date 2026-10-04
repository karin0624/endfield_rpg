import { describe, expect, it } from "vitest";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import {
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  type BattleState,
  createBattleState,
  performBattleSkillAndAdvanceToAllyInput,
} from "./battle";
import { type ActiveSkillDefinition, type SkillCatalog, validateSkillCatalog } from "./skills";
import { healthyStatus } from "./status";

const attack = {
  id: "repeat",
  name: "連続攻撃（試験入力）",
  description: "数値効果の反復",
  tier: "normal",
  type: "active",
  effect: { type: "damage", amount: 0, scaling: { stat: "maxHp", coefficient: 0.1 }, hitCount: 3 },
  mentalFatigueIncrease: 100,
  scenes: ["battle"],
  target: "single-enemy",
} satisfies ActiveSkillDefinition;
function catalog(skill: ActiveSkillDefinition = attack): SkillCatalog {
  const result = { skills: [skill], pools: [], characters: [] };
  validateSkillCatalog(result, []);
  return result;
}
function start(seed = 1, actor: Partial<BattleCombatantDefinition> = {}, firstHp = 100) {
  return advanceBattleToNextAllyInput(
    createBattleState(
      [
        {
          id: "user",
          team: "ally",
          speed: 100,
          hp: 200,
          maxHp: 200,
          attackPower: 0,
          mentalFatigue: 300,
          hitRate: 1,
          learnedSkills: [{ skillId: "repeat", type: "active", origin: "initial", acquisition: "initial" }],
          ...actor,
        },
        // The lexical order deliberately differs from definition order.
        { id: "z", team: "enemy", speed: 50, hp: firstHp, attackPower: 2 },
        { id: "dead", team: "enemy", speed: 50, hp: 0, maxHp: 100, attackPower: 2 },
        { id: "a", team: "enemy", speed: 50, hp: 100, attackPower: 2 },
      ],
      seed,
    ),
  ).state;
}
function use(
  state: BattleState,
  skill: ActiveSkillDefinition = attack,
  target: string | null = "z",
  time = state.logicalTime,
) {
  return performBattleSkillAndAdvanceToAllyInput(
    state,
    "user",
    target,
    skill.id,
    time,
    catalog(skill),
    mentalFatigueDefinition,
  );
}
function accepted(result: ReturnType<typeof use>) {
  if (!result.accepted) throw new Error(result.reason);
  return result;
}
function member(state: BattleState, id: string) {
  const found = state.combatants.find((entry) => entry.id === id);
  if (!found) throw new Error(`戦闘者がありません: ${id}`);
  return found;
}

describe("多段・複数対象の公開runtime", () => {
  it.each([
    [0.5 - 1 / 0x100000000, false, 100],
    [0.5, false, 100],
    [0.5 + 1 / 0x100000000, true, 80],
  ])("スキル命中率%sも乱数0.5を含まない厳密な境界を使う", (hitRate, hit, hp) => {
    const skill = { ...attack, mentalFatigueIncrease: 0, effect: { ...attack.effect, hitCount: 1 } };
    const result = accepted(use(start(2782269413, { hitRate, mentalFatigue: 0 }), skill));
    expect(result.events[0]).toMatchObject({ type: "skill", hit, amount: hit ? 20 : 0 });
    expect(member(result.state, "z").hp).toBe(hp);
    expect(result.state.randomState).toBe(2147483648);
  });
  it.each(["single-enemy", "all-enemies"] as const)(
    "%sは使用前能力・疲労で全効果を解決してから一度発症する",
    (target) => {
      const skill = { ...attack, target };
      const result = accepted(use(start(), skill, target === "all-enemies" ? null : "z"));
      // maxHP200 * .1 / (1 + 300/100) = 5 per hit, then physical fatigue100 clamps HP to100.
      expect(member(result.state, "z").hp).toBe(85);
      expect(member(result.state, "a").hp).toBe(target === "all-enemies" ? 85 : 100);
      expect(member(result.state, "user")).toMatchObject({
        mentalFatigue: 400,
        hp: 100,
        status: { physicalFatigue: 100, haze: 0 },
      });
      const hits = result.events.filter((event) => event.type === "skill");
      expect(hits.map((event) => [event.targetId, event.hitIndex, event.amount])).toEqual(
        target === "all-enemies"
          ? [
              ["z", 1, 5],
              ["z", 2, 5],
              ["z", 3, 5],
              ["a", 1, 5],
              ["a", 2, 5],
              ["a", 3, 5],
            ]
          : [
              ["z", 1, 5],
              ["z", 2, 5],
              ["z", 3, 5],
            ],
      );
      expect(result.events.filter((event) => event.type === "symptom")).toHaveLength(1);
      expect(result.state.randomState).toBe(1586005467); // onset and selection only
      expect(result.state.logicalTime).toBe(200); // interval 10000/100; ally wins the time200 tie
      expect(member(result.state, "user").nextActionTime).toBe(200);
      const next = accepted(use(result.state, skill, target === "all-enemies" ? null : "z"));
      expect(member(next.state, "z").hp).toBe(79); // next use maxHP100 * .1 /5 = 2, three hits
    },
  );
  it("seed17の混在命中は使用後の朦朧を先取りせず、命中→発症→候補の順で抽選する", () => {
    const result = accepted(use(start(17, { hitRate: 0.9 })));
    // .2427,.8205,.4596 all hit at .9; .8205 would miss with the post-use .675 rate.
    expect(result.events.filter((event) => event.type === "skill").map((event) => event.amount)).toEqual([5, 5, 5]);
    expect(member(result.state, "user").status.haze).toBe(100);
    expect(result.state.randomState).toBe(3066622768);
    const mixed = accepted(
      use(
        start(1, { hitRate: 0.5 }),
        { ...attack, target: "all-enemies", effect: { ...attack.effect, hitCount: 2 } },
        null,
      ),
    );
    expect(
      mixed.events.filter((event) => event.type === "skill").map((event) => [event.targetId, event.hit, event.amount]),
    ).toEqual([
      ["z", true, 5],
      ["z", true, 5],
      ["a", false, 0],
      ["a", false, 0],
    ]);
    expect(member(mixed.state, "z").hp).toBe(90);
    expect(member(mixed.state, "a").hp).toBe(100);
    expect(mixed.state.randomState).toBe(1587069247); // four hits + onset + selection
  });
  it("途中撃破で残りの命中抽選を打ち切り、他へ振り替えない", () => {
    const result = accepted(use(start(1, { hitRate: 0.5 }, 3)));
    expect(result.events.filter((event) => event.type === "skill").map((event) => event.amount)).toEqual([3]);
    expect(member(result.state, "z")).toMatchObject({ hp: 0, isAlive: false });
    expect(member(result.state, "a").hp).toBe(100);
    expect(result.state.randomState).toBe(2165703038); // one hit + onset + selection
    expect(member(result.state, "user").status.haze).toBe(100);
    expect(result.events.filter((event) => event.type === "combatant-defeated")).toHaveLength(1);
  });
  it("全体攻撃は死体を除外して各敵の残りを打ち切り、全滅後は敵を進めない", () => {
    const skill = { ...attack, target: "all-enemies" as const, effect: { ...attack.effect, amount: 400 } };
    const result = accepted(use(start(), skill, null));
    expect(result.state.outcome).toBe("victory");
    expect(result.events.map((event) => event.type)).toEqual([
      "skill",
      "combatant-defeated",
      "skill",
      "combatant-defeated",
      "symptom",
      "battle-ended",
    ]);
    expect(member(result.state, "user").hp).toBe(100);
    expect(result.state.logicalTime).toBe(100);
    expect(use(result.state, skill, null)).toMatchObject({
      accepted: false,
      reason: "battle-ended",
      state: result.state,
      events: [],
    });
  });
  it.each([0, 1])("負荷0・命中%sは疲労減衰・発症・命中乱数を使わない", (hitRate) => {
    const result = accepted(use(start(1, { hitRate }), { ...attack, mentalFatigueIncrease: 0 }));
    expect(member(result.state, "z").hp).toBe(hitRate === 1 ? 40 : 100);
    expect(member(result.state, "user")).toMatchObject({ hp: 200, mentalFatigue: 300, status: healthyStatus() });
    expect(result.state.randomState).toBe(1);
    expect(result.events.filter((event) => event.type === "skill").map((event) => event.hit)).toEqual([
      !!hitRate,
      !!hitRate,
      !!hitRate,
    ]);
  });
  it("命中0でも有効使用の疲労・発症は一度、上限候補なしなら発症抽選なし", () => {
    const missed = accepted(use(start(1, { hitRate: 0 })));
    expect(member(missed.state, "z").hp).toBe(100);
    expect(member(missed.state, "user")).toMatchObject({ mentalFatigue: 400, status: { physicalFatigue: 100 } });
    expect(missed.state.randomState).toBe(1586005467);
    const capped = accepted(
      use(start(1, { hitRate: 0, status: { ...healthyStatus(), physicalFatigue: 200, haze: 200 } })),
    );
    expect(capped.state.randomState).toBe(1);
    expect(member(capped.state, "user").mentalFatigue).toBe(400);
    expect(capped.events.filter((event) => event.type === "symptom")).toEqual([]);
    const single = accepted(use(start(1, { hitRate: 0, status: { ...healthyStatus(), physicalFatigue: 200 } })));
    expect(member(single.state, "user").status.haze).toBe(100);
    expect(single.state.randomState).toBe(1586005467); // selection remains required with one candidate
  });
  it("不正対象・死体・対象形式・未習得・古い入力・再送は副作用なし", () => {
    const state = start();
    const all = { ...attack, target: "all-enemies" as const };
    for (const invoke of [
      () => use(state, attack, "dead"),
      () => use(state, attack, "user"),
      () => use(state, attack, "missing"),
      () => use(state, attack, null),
      () => use(state, all, "z"),
      () => use(state, all, "dead"),
      () => use(state, all, "missing"),
      () => use(state, { ...attack, id: "unknown" }),
      () => use(state, attack, "z", -1),
    ]) {
      const before = structuredClone(state);
      expect(invoke()).toMatchObject({ accepted: false, state: before, events: [] });
      expect(state).toEqual(before);
    }
    const result = accepted(use(state));
    const beforeReplay = structuredClone(result.state);
    expect(use(result.state, attack, "z", state.logicalTime)).toMatchObject({
      accepted: false,
      reason: "action-not-current",
      state: beforeReplay,
      events: [],
    });
    expect(result.state).toEqual(beforeReplay);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "不正な回数%sと未承認の全体回復を拒否する",
    (hitCount) => {
      expect(() => catalog({ ...attack, effect: { ...attack.effect, hitCount } })).toThrow();
      expect(() =>
        catalog({
          ...attack,
          target: "all-enemies",
          effect: { type: "hp-recovery", amount: 1, scaling: { stat: "maxHp", coefficient: 1 } },
        }),
      ).toThrow();
    },
  );
});
