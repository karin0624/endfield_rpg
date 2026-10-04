import { describe, expect, it } from "vitest";
import {
  createExplorationGrowth,
  type ExperienceReward,
  type GrowthResult,
  grantExperience,
  type ProgressionDefinition,
  resetCharacterGrowth,
  validateProgressionDefinition,
} from "./progression";

/** Fictional fixtures only: not agreed initial levels, curves or distribution. */
const definition: ProgressionDefinition = {
  initial: [
    { characterId: "player", level: 4, experience: 8, bonus: { maxHp: 1, attackPower: 2 } },
    { characterId: "gilberta", level: 9, experience: 0, bonus: { maxHp: 0, attackPower: 0 } },
  ],
  rules: Array.from({ length: 12 }, (_, index) => ({
    fromLevel: index + 1,
    requiredExperience: 10,
    bonus: { maxHp: 2, attackPower: 1 },
  })),
};
function accepted(result: GrowthResult) {
  if (!result.accepted) throw new Error(result.reason);
  return result;
}
function reward(id: string, experience: number): ExperienceReward {
  return { id, allocations: [{ characterId: "player", experience }] };
}

describe("探索内成長コア", () => {
  it("明示された初期レベル・余剰経験値・補正から作り、初期到達への選択権利は作らない", () => {
    expect(createExplorationGrowth(definition)).toEqual({
      characters: [
        {
          characterId: "player",
          level: 4,
          experience: 8,
          bonus: { maxHp: 1, attackPower: 2 },
          pendingChoiceLevels: [],
        },
        {
          characterId: "gilberta",
          level: 9,
          experience: 0,
          bonus: { maxHp: 0, attackPower: 0 },
          pendingChoiceLevels: [],
        },
      ],
      appliedRewardIds: [],
    });
  });
  it.each([
    { xp: 9, level: 4, surplus: 9, maxHp: 1, attackPower: 2, choices: [] },
    { xp: 10, level: 5, surplus: 0, maxHp: 3, attackPower: 3, choices: [5] },
    { xp: 11, level: 5, surplus: 1, maxHp: 3, attackPower: 3, choices: [5] },
  ])("閾値直前・一致・超過: $xp", ({ xp, level, surplus, maxHp, attackPower, choices }) => {
    const zeroXpDefinition = {
      ...definition,
      initial: [{ ...definition.initial[0], experience: 0 }],
    };
    const result = accepted(
      grantExperience(createExplorationGrowth(zeroXpDefinition), reward("battle:1", xp), zeroXpDefinition),
    );
    expect(result.state.characters[0]).toMatchObject({
      level,
      experience: surplus,
      bonus: { maxHp, attackPower },
      pendingChoiceLevels: choices,
    });
  });
  it("Lv4→6とLv9→11で全到達レベルを各1回残し、余剰もキャラ別に保持する", () => {
    const result = accepted(
      grantExperience(
        createExplorationGrowth(definition),
        {
          id: "battle:multi",
          allocations: [
            { characterId: "player", experience: 17 },
            { characterId: "gilberta", experience: 25 },
          ],
        },
        definition,
      ),
    );
    expect(result.state.characters).toEqual([
      {
        characterId: "player",
        level: 6,
        experience: 5,
        bonus: { maxHp: 5, attackPower: 4 },
        pendingChoiceLevels: [5, 6],
      },
      {
        characterId: "gilberta",
        level: 11,
        experience: 5,
        bonus: { maxHp: 4, attackPower: 2 },
        pendingChoiceLevels: [10, 11],
      },
    ]);
    expect(result.levelsReached).toEqual([
      { characterId: "player", level: 5 },
      { characterId: "player", level: 6 },
      { characterId: "gilberta", level: 10 },
      { characterId: "gilberta", level: 11 },
    ]);
  });
  it("報酬源を決めず次の報酬へ引継ぎ、対象外キャラの成長を維持する", () => {
    const first = accepted(grantExperience(createExplorationGrowth(definition), reward("battle:1", 3), definition));
    const next = accepted(grantExperience(first.state, reward("event:1", 9), definition));
    expect(next.state.characters[0]).toMatchObject({
      level: 6,
      experience: 0,
      bonus: { maxHp: 5, attackPower: 4 },
      pendingChoiceLevels: [5, 6],
    });
    expect(next.state.characters[1]).toMatchObject({ level: 9, experience: 0, pendingChoiceLevels: [] });
    expect(next.levelsReached).toEqual([{ characterId: "player", level: 6 }]);
  });
  it("報酬再送ではXP・権利を増やさず、元状態も変更しない", () => {
    const original = createExplorationGrowth(definition);
    const first = accepted(grantExperience(original, reward("battle:once", 17), definition));
    const duplicate = grantExperience(first.state, reward("battle:once", 100), definition);
    expect(duplicate).toEqual({ accepted: false, state: first.state, reason: "reward-already-applied" });
    expect(original.characters[0]).toMatchObject({ level: 4, experience: 8, pendingChoiceLevels: [] });
  });
  it.each([
    { id: " ", allocations: [], reason: "invalid-reward-id" },
    { id: "bad", allocations: [{ characterId: "missing", experience: 1 }], reason: "unknown-character" },
    {
      id: "bad",
      allocations: [
        { characterId: "player", experience: 1 },
        { characterId: "player", experience: 2 },
      ],
      reason: "duplicate-character",
    },
    ...[-1, 0.3, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY].map((experience) => ({
      id: "bad",
      allocations: [{ characterId: "gilberta", experience }],
      reason: "invalid-experience",
    })),
  ])("無効報酬は全体を拒否し、IDも消費しない: [%#] $reason", ({ id, allocations, reason }) => {
    const state = createExplorationGrowth(definition);
    const result = grantExperience(
      state,
      {
        id,
        allocations: [{ characterId: "player", experience: 17 }, ...allocations],
      },
      definition,
    );
    expect(result).toEqual({ accepted: false, state, reason });
    const retry = accepted(grantExperience(state, reward("bad", 2), definition));
    expect(retry.state.characters[0]).toMatchObject({ level: 5, experience: 0, pendingChoiceLevels: [5] });
  });
  it("経験値なしと0配分を許容し、選択権利や成長を作らない", () => {
    const state = createExplorationGrowth(definition);
    const none = accepted(grantExperience(state, { id: "no-xp", allocations: [] }, definition));
    const zero = accepted(grantExperience(none.state, reward("zero", 0), definition));
    expect(zero.state.characters).toEqual(state.characters);
    expect(zero.levelsReached).toEqual([]);
    expect(zero.state.appliedRewardIds).toEqual(["no-xp", "zero"]);
  });
  it("不足ルールはXPを捨てず全体を拒否し、最終到達の余剰0は扱える", () => {
    const shortDefinition = {
      ...definition,
      rules: definition.rules.filter(({ fromLevel }) => fromLevel === 4),
    };
    const state = createExplorationGrowth(shortDefinition);
    const exact = accepted(grantExperience(state, reward("exact", 2), shortDefinition));
    expect(exact.state.characters[0]).toMatchObject({ level: 5, experience: 0, pendingChoiceLevels: [5] });
    expect(grantExperience(state, reward("overflow", 3), shortDefinition)).toEqual({
      accepted: false,
      state,
      reason: "missing-level-rule",
    });
  });
  it("数値オーバーフローはIDを消費せず拒否する", () => {
    const largeDefinition: ProgressionDefinition = {
      initial: [
        { characterId: "a", level: 1, experience: Number.MAX_SAFE_INTEGER - 1, bonus: { maxHp: 0, attackPower: 0 } },
      ],
      rules: [{ fromLevel: 1, requiredExperience: Number.MAX_SAFE_INTEGER, bonus: { maxHp: 0, attackPower: 0 } }],
    };
    const state = createExplorationGrowth(largeDefinition);
    expect(
      grantExperience(
        state,
        {
          id: "large",
          allocations: [{ characterId: "a", experience: 2 }],
        },
        largeDefinition,
      ),
    ).toEqual({ accepted: false, state, reason: "numeric-overflow" });
    const bonusDefinition: ProgressionDefinition = {
      initial: [{ characterId: "a", level: 1, experience: 0, bonus: { maxHp: 1e308, attackPower: 0 } }],
      rules: [{ fromLevel: 1, requiredExperience: 1, bonus: { maxHp: 1e308, attackPower: 0 } }],
    };
    const bonusState = createExplorationGrowth(bonusDefinition);
    expect(
      grantExperience(
        bonusState,
        {
          id: "large",
          allocations: [{ characterId: "a", experience: 1 }],
        },
        bonusDefinition,
      ),
    ).toEqual({ accepted: false, state: bonusState, reason: "numeric-overflow" });
  });
  it("成長だけを明示的に初期化し、余剰・補正・権利を戻し、報酬再送を防ぐ", () => {
    const grown = accepted(
      grantExperience(
        createExplorationGrowth(definition),
        {
          id: "battle:1",
          allocations: [
            { characterId: "player", experience: 17 },
            { characterId: "gilberta", experience: 25 },
          ],
        },
        definition,
      ),
    );
    const reset = accepted(resetCharacterGrowth(grown.state, ["player"], definition));
    expect(reset.state.characters[0]).toEqual({
      characterId: "player",
      level: 4,
      experience: 8,
      bonus: { maxHp: 1, attackPower: 2 },
      pendingChoiceLevels: [],
    });
    expect(reset.state.characters[1]).toMatchObject({ level: 11, experience: 5, pendingChoiceLevels: [10, 11] });
    expect(grantExperience(reset.state, reward("battle:1", 17), definition)).toMatchObject({
      accepted: false,
      reason: "reward-already-applied",
    });
    expect(accepted(resetCharacterGrowth(reset.state, ["player"], definition)).state.characters[0]).toMatchObject({
      level: 4,
      experience: 8,
      pendingChoiceLevels: [],
    });
    expect(createExplorationGrowth(definition).appliedRewardIds).toEqual([]);
  });
  it.each([["missing"], ["player", "player"]])("未知・重複初期化対象を拒否する: %j", (...ids) => {
    const state = createExplorationGrowth(definition);
    expect(resetCharacterGrowth(state, ids, definition)).toMatchObject({ accepted: false, state });
  });
  it.each([
    { ...definition, initial: [...definition.initial, definition.initial[0]] },
    { ...definition, rules: [...definition.rules, definition.rules[0]] },
    ...["", " "].map((characterId) => ({
      ...definition,
      initial: [{ ...definition.initial[0], characterId }],
    })),
    ...[0, 1.5, Number.NaN, Number.POSITIVE_INFINITY].map((level) => ({
      ...definition,
      initial: [{ ...definition.initial[0], level }],
    })),
    ...[-1, 0.3, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, 10].map((experience) => ({
      ...definition,
      initial: [{ ...definition.initial[0], experience }],
    })),
    ...[0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY].map((requiredExperience) => ({
      ...definition,
      initial: definition.initial.map((initial) => ({ ...initial, experience: 0 })),
      rules: [{ fromLevel: 4, requiredExperience, bonus: { maxHp: 0, attackPower: 0 } }],
    })),
    ...[-1, Number.NaN, Number.POSITIVE_INFINITY].map((maxHp) => ({
      ...definition,
      initial: [{ ...definition.initial[0], bonus: { maxHp, attackPower: 0 } }],
    })),
    ...[0, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN].map((fromLevel) => ({
      ...definition,
      rules: definition.rules.map((rule, index) => (index === 0 ? { ...rule, fromLevel } : rule)),
    })),
    { ...definition, initial: [{ ...definition.initial[0], level: Number.MAX_SAFE_INTEGER + 1, experience: 0 }] },
    ...[-1, Number.NaN, Number.POSITIVE_INFINITY].flatMap((attackPower) => [
      { ...definition, initial: [{ ...definition.initial[0], bonus: { maxHp: 0, attackPower } }] },
      {
        ...definition,
        rules: definition.rules.map((rule, index) =>
          index === 0 ? { ...rule, bonus: { maxHp: 0, attackPower } } : rule,
        ),
      },
      {
        ...definition,
        rules: definition.rules.map((rule, index) =>
          index === 0 ? { ...rule, bonus: { maxHp: attackPower, attackPower: 0 } } : rule,
        ),
      },
    ]),
  ])("不正な設定を拒否する [%#]", (invalid) => {
    expect(() => validateProgressionDefinition(invalid)).toThrow();
  });
});
