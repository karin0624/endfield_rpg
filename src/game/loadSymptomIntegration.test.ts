import { describe, expect, it } from "vitest";
import { completeMarketVisit } from "../../tests/helpers/completeMarketVisit";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import {
  advanceBattleToNextActor,
  type BattleCombatantDefinition,
  createBattleState,
  performBattleSkill,
} from "./battle";
import { createInitialGameState } from "./createInitialGameState";
import { actInExpedition, actInTown, departOnExpedition, type ExpeditionGame } from "./expedition";
import { chooseGrowthSkill, grownCharacters, rewardGrowth } from "./growthRuntime";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";
import { initialLearnedSkills } from "./skills";
import { healthyStatus } from "./status";

function battle(overrides: Partial<BattleCombatantDefinition> = {}, seed = 1) {
  return advanceBattleToNextActor(
    createBattleState(
      [
        {
          id: "player",
          team: "ally",
          hp: 200,
          maxHp: 200,
          attackPower: 8,
          speed: 100,
          mentalFatigue: 20,
          learnedSkills: initialLearnedSkills(skillCatalog, "player"),
          ...overrides,
        },
        { id: "enemy", team: "enemy", hp: 200, maxHp: 200, attackPower: 0, speed: 1 },
      ],
      seed,
    ),
  );
}
function use(state: ReturnType<typeof battle>, load = 20, skillId = "test-strike", targetId = "enemy") {
  const catalog = {
    ...skillCatalog,
    skills: skillCatalog.skills.map((skill) =>
      skill.type === "active" ? { ...skill, mentalFatigueIncrease: load } : skill,
    ),
  };
  return performBattleSkill(state, "player", targetId, skillId, state.logicalTime, catalog, mentalFatigueDefinition);
}

describe("追加発症を含む有効使用の確定順序", () => {
  it("使用前20で効果を適用し、使用後40で発症し、重度80から100へ悪化する", () => {
    const result = use(battle({ status: { ...healthyStatus(), physicalFatigue: 80 } }));
    expect(result.accepted).toBe(true);
    expect(result.events[0]).toMatchObject({
      type: "skill",
      fatigueBefore: 20,
      fatigueAfter: 40,
    });
    expect(result.events[0]).toMatchObject({ amount: expect.closeTo(40 / 3, 12) });
    // Seed1's first draw is 0.23645: greater than p(20)=1/6, less than p(40)=2/7.
    expect(result.events[1]).toEqual({
      type: "symptom",
      actorId: "player",
      kind: "physicalFatigue",
      before: 80,
      after: 100,
    });
    expect(result.state.combatants[0]).toMatchObject({ hp: 100, mentalFatigue: 40, status: { physicalFatigue: 100 } });
    expect(result.state.combatants[1].hp).toBeCloseTo(186.66666666666666, 12);
    expect(result.state.randomState).toBe(1586005467);
  });
  it("自己回復の基礎量は発症前の最大HPで計算し、発症後に上限だけ収める", () => {
    const result = use(
      battle({ hp: 50, status: { ...healthyStatus(), physicalFatigue: 100 } }),
      20,
      "test-heal",
      "player",
    );
    expect(result.events[0]).toMatchObject({ type: "skill", fatigueBefore: 20, fatigueAfter: 40 });
    if (result.events[0].type !== "skill") throw new Error("skill event missing");
    expect(result.events[0].amount).toBeCloseTo(48.333333333333336, 12); // (8 + 100*0.5) / 1.2
    expect(result.state.combatants[0]).toMatchObject({ hp: 90, status: { physicalFatigue: 120 } });
  });
  it("全候補が上限なら回復使用は有効でも発症イベント・追加乱数がない", () => {
    const result = use(
      battle({ status: { ...healthyStatus(), physicalFatigue: 200, haze: 200 } }),
      20,
      "test-heal",
      "player",
    );
    expect(result.accepted).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.state.randomState).toBe(1);
    expect(result.state.combatants[0].mentalFatigue).toBe(40);
  });
  it("ゼロ負荷は疲労減衰・追加発症を行わず、大負荷でも有限の症状上限で止める", () => {
    const zero = use(battle(), 0);
    expect(zero.events).toMatchObject([{ type: "skill", amount: 16, fatigueAfter: 20 }]);
    expect(zero.state.randomState).toBe(1);
    const huge = use(battle({ mentalFatigue: 0 }), Number.MAX_VALUE);
    expect(huge.state.combatants[0]).toMatchObject({ hp: 66, status: { physicalFatigue: 200 } });
    expect(huge.events.filter((event) => event.type === "symptom")).toHaveLength(1);
  });
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 201])("不正な症状値%sの戦闘定義を拒否する", (value) => {
    expect(() => battle({ status: { ...healthyStatus(), haze: value } })).toThrow();
  });
});

describe("成長・街回復・現行保存との境界", () => {
  it("症状補正後の成長増分だけHPへ加え、権利解決後の実街完了はHPを増やさず回復する", () => {
    const initial: ExpeditionGame = {
      adventure: createInitialGameState(initialGameOptions),
      party: {
        ...createParty(characters, ["player"]),
        members: [
          { id: "player", hp: 8, mentalFatigue: 40, status: { ...healthyStatus(), physicalFatigue: 100, haze: 75 } },
        ],
      },
      dungeon: null,
      randomState: 1586005467,
    };
    const grown = rewardGrowth(
      initial,
      { id: "after-onset", allocations: [{ characterId: "player", experience: 10 }] },
      { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules },
    );
    expect(grown.accepted).toBe(true);
    expect(grown.state.party.members[0]).toMatchObject({
      hp: 10,
      mentalFatigue: 40,
      status: { physicalFatigue: 100, haze: 75 },
    });
    const choice = grown.state.growth?.choice;
    if (!choice || !grown.state.growth) throw new Error("choice");
    const settled = chooseGrowthSkill(grown.state, "test-vitality", {
      catalog: skillCatalog,
      fatigue: mentalFatigueDefinition,
      growth: growthRules,
    });
    expect(settled.accepted).toBe(true);
    expect(settled.state.party.members[0].hp).toBe(12);
    // Recovery uses the confirmed grown maximum HP; it does not grant further growth.
    const recovered = completeMarketVisit(
      settled.state,
      grownCharacters(settled.state, { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules }),
      mentalFatigueDefinition,
    );
    expect(recovered.party.members[0]).toMatchObject({
      hp: 12,
      mentalFatigue: 30,
      status: { physicalFatigue: 90, haze: 65 },
    });
    expect(recovered.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1, pendingAction: null });
    expect(recovered.randomState).toBe(settled.state.randomState);
    expect(
      actInTown(recovered, { type: "advance" }, characters, initialAdventure, mentalFatigueDefinition),
    ).toMatchObject({ accepted: false, state: recovered });
  });
  it("現行版は端数症状と乱数を保持し、旧版・不正な数値を変換しない", () => {
    const game: ExpeditionGame = {
      adventure: createInitialGameState(initialGameOptions),
      dungeon: null,
      randomState: 1586005467,
      party: {
        ...createParty(characters, ["player"]),
        members: [
          {
            id: "player",
            hp: 5,
            mentalFatigue: 40.125,
            status: { physicalFatigue: 80.125, haze: 199.875, incapacityRecoverySteps: 2 },
          },
        ],
      },
    };
    const saved = serializeGame(game, saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    const restored = deserializeGame(saved.data, saveDefinitions);
    if (!restored.accepted) throw new Error(restored.reason);
    expect(restored.state.party.members).toEqual(game.party.members);
    expect(restored.state.randomState).toBe(1586005467);
    for (const version of [1, 2, 3]) {
      expect(deserializeGame(JSON.stringify({ ...JSON.parse(saved.data), version }), saveDefinitions)).toEqual({
        accepted: false,
        reason: "unsupported-version",
      });
    }
    for (const kind of ["physicalFatigue", "haze"])
      for (const value of [-1, 200.01, null, "25"]) {
        const data = JSON.parse(saved.data);
        data.party.members[0].status[kind] = value;
        expect(deserializeGame(JSON.stringify(data), saveDefinitions)).toEqual({
          accepted: false,
          reason: "invalid-data",
        });
      }
  });
});

it.each([
  { physicalFatigue: 0, haze: 150, hp: 20, returnedHp: 20 },
  { physicalFatigue: 40, haze: 65, hp: 13, returnedHp: 14 },
])("ブラウザの療養fixtureは実戦闘で敗北し症状を保持して帰還する: %j", ({ physicalFatigue, haze, hp, returnedHp }) => {
  const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules };
  const initial: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    dungeon: null,
    randomState: 3,
    party: {
      ...createParty(characters, ["player"]),
      members: [
        { id: "player", hp, mentalFatigue: 0, status: { physicalFatigue, haze, incapacityRecoverySteps: null } },
      ],
    },
  };
  const departed = departOnExpedition(initial, characters, initialDungeon, initialAdventure, rules);
  if (!departed.accepted) throw new Error(departed.reason);
  let game = actInExpedition(
    departed.state,
    { type: "enter", nodeId: "battle-a" },
    initialDungeon,
    initialAdventure,
    rules,
  ).state;
  for (let turn = 0; turn < 12 && game.dungeon?.activity?.type === "battle"; turn++) {
    const target = game.dungeon.activity.state.combatants
      .filter((entry) => entry.team === "enemy" && entry.isAlive)
      .at(-1);
    if (!target) throw new Error("enemy missing");
    game = actInExpedition(
      game,
      { type: "attack", actorId: "player", targetId: target.id },
      initialDungeon,
      initialAdventure,
      rules,
    ).state;
  }
  expect(game.dungeon).toBeNull();
  expect(game.party.members[0]).toMatchObject({
    hp: returnedHp,
    status: { physicalFatigue, haze, incapacityRecoverySteps: 6 },
  });
});
