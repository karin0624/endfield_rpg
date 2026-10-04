import { describe, expect, it } from "vitest";
import { mentalFatigueDefinition as fatigue } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import {
  advanceBattleToNextActor,
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  createBattleState,
  getBattleUpcomingActions,
  performBasicAttack,
  performBattleSkill,
} from "./battle";
import {
  advanceToNextActor,
  completeCurrentAction,
  createBattleTimeline,
  getUpcomingActions,
  setCombatantAlive,
} from "./battleTimeline";
import { createInitialGameState } from "./createInitialGameState";
import type { ExpeditionGame } from "./expedition";
import { chooseGrowthSkill, grownCharacters, rewardGrowth } from "./growthRuntime";
import { createParty } from "./party";
import {
  type ActiveSkillDefinition,
  activeSkillBaseAmount,
  type PassiveSkillDefinition,
  passiveSkillAmount,
  type SkillCatalog,
  skillById,
  validateSkillCatalog,
} from "./skills";
import { healthyStatus } from "./status";
import { multidayFixture } from "./testing/multidayFixture";

const strike = skillById(skillCatalog, "test-strike") as ActiveSkillDefinition;
const heal = skillById(skillCatalog, "test-heal") as ActiveSkillDefinition;
const definitions: BattleCombatantDefinition[] = [
  {
    id: "hero",
    team: "ally",
    hp: 20,
    maxHp: 40,
    speed: 100,
    attackPower: 8,
    learnedSkills: [
      { skillId: "test-strike", type: "active", origin: "initial", acquisition: "initial" },
      { skillId: "test-heal", type: "active", origin: "initial", acquisition: "initial" },
    ],
  },
  { id: "friend", team: "ally", hp: 10, maxHp: 40, speed: 50, attackPower: 2 },
  { id: "enemy", team: "enemy", hp: 30, speed: 40, attackPower: 3 },
];
const start = (overrides: Partial<BattleCombatantDefinition> = {}) =>
  advanceBattleToNextActor(createBattleState(definitions.map((d) => (d.id === "hero" ? { ...d, ...overrides } : d))));
const use = (
  state: ReturnType<typeof start>,
  target = "enemy",
  id = "test-strike",
  catalog: SkillCatalog = skillCatalog,
  actor = "hero",
) => performBattleSkill(state, actor, target, id, state.logicalTime, catalog, fatigue);

describe("戦闘公開契約の監査境界", () => {
  it("入力待ち・行動完了・不能化は時計を勝手に進めず入力も変更しない", () => {
    const input = [
      { id: "z", speed: 100 },
      { id: "a", speed: 50 },
    ];
    const definitionBefore = structuredClone(input);
    const initial = createBattleTimeline(input);
    const initialBefore = structuredClone(initial);
    const waiting = advanceToNextActor(initial);
    expect(initial).toEqual(initialBefore);
    expect(input).toEqual(definitionBefore);
    const before = structuredClone(waiting);
    expect(advanceToNextActor(waiting)).toMatchObject({
      logicalTime: 100,
      currentActorId: "z",
      combatants: [{ nextActionTime: 100 }, { nextActionTime: 200 }],
    });
    const completed = completeCurrentAction(waiting);
    expect(completed).toMatchObject({
      logicalTime: 100,
      currentActorId: null,
      combatants: [{ nextActionTime: 200 }, { nextActionTime: 200 }],
    });
    expect(advanceToNextActor(completed).currentActorId).toBe("z");
    const disabled = setCombatantAlive(waiting, "z", false);
    expect(disabled).toMatchObject({
      logicalTime: 100,
      currentActorId: null,
      combatants: [{ isAlive: false }, { isAlive: true }],
    });
    expect(waiting).toEqual(before);
  });
  it("合法な極低速でも二行動目の安全整数overflowを拒否する", () => {
    const waiting = advanceToNextActor(createBattleTimeline([{ id: "slow", speed: 10000 / 2 ** 52 }]));
    expect(waiting.logicalTime).toBe(4503599627370496);
    const before = structuredClone(waiting);
    expect(() => completeCurrentAction(waiting)).toThrow("安全な整数tick");
    expect(waiting).toEqual(before);
  });
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("予告数%sは進行中と終了後の両方で拒否する", (count) => {
    expect(() => getUpcomingActions(createBattleTimeline([{ id: "a", speed: 100 }]), count)).toThrow();
    const ended = createBattleState(definitions.map((d) => (d.team === "enemy" ? { ...d, hp: 0 } : d)));
    expect(() => getBattleUpcomingActions(ended, count)).toThrow();
  });
  it("予告0と勝敗後の全遷移は進行せず追加入力を拒否する", () => {
    expect(getUpcomingActions(createBattleTimeline([{ id: "a", speed: 100 }]), 0)).toEqual([]);
    for (const defeated of ["ally", "enemy"]) {
      const ended = createBattleState(definitions.map((d) => (d.team === defeated ? { ...d, hp: 0 } : d)));
      const before = structuredClone(ended);
      expect(getBattleUpcomingActions(ended, 0)).toEqual([]);
      expect(getBattleUpcomingActions(ended, 3)).toEqual([]);
      expect(advanceBattleToNextActor(ended)).toEqual(before);
      expect(advanceBattleToNextAllyInput(ended)).toEqual({ state: before, events: [] });
      expect(performBasicAttack(ended, "hero", "enemy")).toMatchObject({
        accepted: false,
        reason: "battle-ended",
        state: before,
        events: [],
      });
      expect(use(ended)).toMatchObject({ accepted: false, reason: "battle-ended", state: before, events: [] });
      expect(ended).toEqual(before);
    }
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e-100])(
    "速度%sと空IDを拒否する",
    (speed) => {
      expect(() => createBattleTimeline([{ id: "a", speed }])).toThrow();
      expect(() => createBattleTimeline([{ id: "", speed: 100 }])).toThrow();
    },
  );
  it("片側だけ・空の戦闘と未選択actorの攻撃を拒否する", () => {
    for (const input of [
      [],
      definitions.filter((d) => d.team === "ally"),
      definitions.filter((d) => d.team === "enemy"),
    ])
      expect(() => createBattleState(input)).toThrow();
    const state = createBattleState(definitions);
    const before = structuredClone(state);
    expect(performBasicAttack(state, "hero", "enemy")).toMatchObject({
      accepted: false,
      reason: "no-current-actor",
      state: before,
      events: [],
    });
    expect(state).toEqual(before);
  });
  it.each([
    ...["hp", "attackPower", "basicAttackBonus"].flatMap((key) =>
      [-1, Number.NaN, Infinity, -Infinity].map((value) => ({ [key]: value })),
    ),
    ...[0, -1, Number.NaN, Infinity].map((maxHp) => ({ maxHp })),
    ...[-0.01, 1.01, Number.NaN, Infinity].map((hitRate) => ({ hitRate })),
    { team: "neutral" },
    { attackPower: Number.MAX_VALUE, basicAttackBonus: Number.MAX_VALUE },
  ])("不正戦闘定義[%#] %jを拒否する", (bad) => {
    expect(() =>
      createBattleState([{ ...definitions[0], ...bad } as BattleCombatantDefinition, definitions[2]]),
    ).toThrow();
  });
  it("受理された基本攻撃とスキルも入力定義・元stateを破壊しない", () => {
    const input = structuredClone(definitions);
    const original = structuredClone(input);
    const initial = createBattleState(input);
    const initialBefore = structuredClone(initial);
    const state = advanceBattleToNextActor(initial);
    const before = structuredClone(state);
    const attack = performBasicAttack(state, "hero", "enemy");
    const skill = use(state);
    expect(attack.accepted).toBe(true);
    expect(skill.accepted).toBe(true);
    expect(attack.state.combatants[2].hp).toBe(22);
    expect(skill.state.combatants[2].hp).toBe(14);
    expect(state).toEqual(before);
    expect(initial).toEqual(initialBefore);
    expect(input).toEqual(original);
  });
  it("不正actor・HP正の不能者・疲労overflowは症状時計乱数を保持して拒否する", () => {
    const cases = [
      {
        state: start(),
        actor: "friend",
        target: "enemy",
        skill: "test-strike",
        reason: "actor-is-not-current",
        catalog: skillCatalog,
      },
      {
        state: start({ status: { ...healthyStatus(), incapacityRecoverySteps: 6 } }),
        actor: "hero",
        target: "enemy",
        skill: "test-strike",
        reason: "actor-is-not-current",
        catalog: skillCatalog,
      },
      {
        state: start({ mentalFatigue: Number.MAX_VALUE }),
        actor: "hero",
        target: "enemy",
        skill: "test-strike",
        reason: "numeric-overflow",
        catalog: {
          ...skillCatalog,
          skills: skillCatalog.skills.map((s) =>
            s.id === strike.id ? { ...strike, mentalFatigueIncrease: Number.MAX_VALUE } : s,
          ),
        },
      },
    ];
    for (const row of cases) {
      const before = structuredClone(row.state);
      expect(use(row.state, row.target, row.skill, row.catalog, row.actor)).toMatchObject({
        accepted: false,
        reason: row.reason,
        events: [],
        state: before,
      });
      expect(row.state).toEqual(before);
    }
  });
  it("回復は命中0かつ朦朧でも必中で対象の症状付き上限へ実量を収める", () => {
    const state = advanceBattleToNextActor(
      createBattleState(
        definitions.map((d) =>
          d.id === "hero"
            ? { ...d, hitRate: 0, status: { ...healthyStatus(), haze: 200 } }
            : d.id === "friend"
              ? { ...d, hp: 18, status: { ...healthyStatus(), physicalFatigue: 100 } }
              : d,
        ),
      ),
    );
    const before = structuredClone(state);
    const result = use(state, "friend", "test-heal");
    expect(result.accepted).toBe(true);
    expect(result.events[0]).toMatchObject({ type: "skill", hit: true, amount: 2, fatigueBefore: 0, fatigueAfter: 3 });
    expect(result.state.combatants[1].hp).toBe(20);
    expect(result.state.randomState).toBe(1015568748);
    expect(state).toEqual(before);
    const blocked = advanceBattleToNextActor(
      createBattleState(
        definitions.map((d) =>
          d.id === "friend" ? { ...d, status: { ...healthyStatus(), incapacityRecoverySteps: 6 } } : d,
        ),
      ),
    );
    const blockedBefore = structuredClone(blocked);
    expect(use(blocked, "friend", "test-heal")).toMatchObject({
      accepted: false,
      reason: "target-is-defeated",
      state: blockedBefore,
      events: [],
    });
    expect(blocked).toEqual(blockedBefore);
  });
  it("初期HP0でstatus省略なら不能6を付与し明示回復済なら再付与しない", () => {
    for (const [status, expected] of [
      [undefined, 6],
      [healthyStatus(), null],
    ] as const) {
      const state = createBattleState(definitions.map((d) => (d.id === "hero" ? { ...d, hp: 0, status } : d)));
      expect(state.combatants[0].status.incapacityRecoverySteps).toBe(expected);
      expect(state.combatants[0].isAlive).toBe(false);
    }
  });
  it("実量0の中間命中率スキルは命中乱数を消費しない", () => {
    const catalog = {
      ...skillCatalog,
      skills: skillCatalog.skills.map((s) =>
        s.id === strike.id ? { ...strike, mentalFatigueIncrease: 0, effect: { ...strike.effect, amount: 0 } } : s,
      ),
    };
    const result = use(start({ hitRate: 0.5, attackPower: 0 }), "enemy", strike.id, catalog);
    expect(result.accepted).toBe(true);
    expect(result.events[0]).toMatchObject({ type: "skill", amount: 0, fatigueAfter: 0 });
    expect(result.state.randomState).toBe(1);
    expect(result.state.combatants[2].hp).toBe(30);
  });
  it("参照値・基礎量overflow・未知能力・回復hitCountを拒否する", () => {
    for (const value of [-1, Number.NaN, Infinity])
      expect(() => activeSkillBaseAmount(strike, { attackPower: value, maxHp: 40 })).toThrow();
    expect(() =>
      activeSkillBaseAmount(
        {
          ...strike,
          effect: { ...strike.effect, amount: Number.MAX_VALUE, scaling: { stat: "attackPower", coefficient: 2 } },
        },
        { attackPower: Number.MAX_VALUE, maxHp: 40 },
      ),
    ).toThrow();
    for (const changed of [
      { ...strike, effect: { ...strike.effect, scaling: { stat: "speed", coefficient: 1 } } },
      { ...heal, effect: { ...heal.effect, hitCount: 1 } },
    ])
      expect(() =>
        validateSkillCatalog({ skills: [changed as ActiveSkillDefinition], pools: [], characters: [] }, []),
      ).toThrow();
  });
  it.each([0, -1, 1.5, Number.NaN, Infinity, 3])("パッシブrank%sは個別上限の外なら拒否する", (rank) => {
    expect(() =>
      passiveSkillAmount(skillById(skillCatalog, "test-strength") as PassiveSkillDefinition, rank),
    ).toThrow();
  });
});

it("レベルとパッシブを得ても速度123と基礎命中率0.73は変わらない", () => {
  const fixture = multidayFixture("cleared");
  const characters = fixture.characters.map((character) => ({ ...character, speed: 123, hitRate: 0.73 }));
  const rules = { catalog: fixture.skills, fatigue, growth: { ...fixture.growth, characters } };
  let game: ExpeditionGame = {
    adventure: createInitialGameState(fixture.initial),
    party: createParty(characters, ["player"]),
    dungeon: null,
    randomState: 1,
  };
  const rewarded = rewardGrowth(
    game,
    { id: "growth", allocations: [{ characterId: "player", experience: 30 }] },
    rules,
  );
  if (!rewarded.accepted) throw new Error(rewarded.reason);
  game = rewarded.state;
  for (const skillId of ["test-strength", "test-power", "test-vitality"]) {
    const growth = game.growth;
    if (!growth?.choice) throw new Error("選択がありません");
    const selected = chooseGrowthSkill(game, skillId, rules);
    if (!selected.accepted) throw new Error(selected.reason);
    game = selected.state;
    const character = grownCharacters(game, rules).find((entry) => entry.id === "player");
    expect(character).toMatchObject({ speed: 123, hitRate: 0.73 });
  }
  expect(grownCharacters(game, rules)[0]).toMatchObject({ maxHp: 216, attackPower: 25, speed: 123, hitRate: 0.73 });
});
