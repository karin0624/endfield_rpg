import { describe, expect, it } from "vitest";
import { createGameRandom } from "./gameRandom";
import type { ProgressionDefinition } from "./progression";
import {
  type AcquisitionResult,
  chooseSkill,
  createExplorationSkills,
  grantSkillExperience,
  prepareSkillChoice,
} from "./skillAcquisition";
import type { SkillCatalog, SkillDefinition, SkillTier } from "./skills";

// 高レベルの境界だけを検証する合法な定義。製品の成長値・習得表ではない。
const tiers: readonly SkillTier[] = ["normal", "advanced", "ultimate"];
const suffixes = ["known", "capped", "guaranteed", "a", "b", "c", "d"];
function fixture(initialLevel: number, exhaustedTier?: SkillTier) {
  const progression: ProgressionDefinition = {
    initial: [{ characterId: "player", level: initialLevel, experience: 0, bonus: { maxHp: 0, attackPower: 0 } }],
    rules: Array.from({ length: 21 }, (_, index) => ({
      fromLevel: index + 1,
      requiredExperience: 10,
      bonus: { maxHp: 1, attackPower: 1 },
    })),
  };
  const skills: SkillDefinition[] = tiers.flatMap((tier) =>
    suffixes.map((suffix): SkillDefinition => {
      const identity = {
        id: `${tier}-${suffix}`,
        name: `境界検証 ${tier} ${suffix}`,
        description: "境界テスト専用",
        tier,
      };
      return suffix === "capped"
        ? { ...identity, type: "passive", effect: { type: "basic-attack-power-bonus", rankAmounts: [1] } }
        : {
            ...identity,
            type: "active",
            effect: { type: "damage", amount: 1, scaling: { stat: "attackPower", coefficient: 1 } },
            mentalFatigueIncrease: 0,
            scenes: ["battle"],
            target: "single-enemy",
          };
    }),
  );
  const catalog: SkillCatalog = {
    skills,
    pools: [
      {
        id: "boundary",
        candidates: {
          normal: suffixes.map((suffix) => `normal-${suffix}`),
          advanced: suffixes.map((suffix) => `advanced-${suffix}`),
          ultimate: suffixes.map((suffix) => `ultimate-${suffix}`),
        },
      },
    ],
    characters: [
      {
        characterId: "player",
        poolId: "boundary",
        initialSkillIds: [
          ...tiers.flatMap((tier) => [`${tier}-known`, `${tier}-capped`]),
          ...(exhaustedTier ? [`${exhaustedTier}-a`, `${exhaustedTier}-b`] : []),
        ],
        guaranteedUnlocks: tiers.map((tier) => ({
          skillId: `${tier}-guaranteed`,
          // 通常の保証技は今回の到達後。それでも抽選から除外される。
          level: initialLevel + (tier === "normal" ? 3 : 1),
        })),
      },
    ],
  };
  return { progression, catalog };
}
function accepted(result: AcquisitionResult) {
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
const boundaries = [
  { initialLevel: 14, milestone: 15, finalLevel: 16, tier: "advanced" },
  { initialLevel: 19, milestone: 20, finalLevel: 21, tier: "ultimate" },
] as const;

describe("Lv15・20をまたぐスキル習得", () => {
  it.each(boundaries)(
    "$initialLevel→$finalLevel で途中の$tier と通常の権利を順に解決し、再入力でも再抽選・重複取得しない",
    ({ initialLevel, milestone, finalLevel, tier }) => {
      const { progression, catalog } = fixture(initialLevel);
      const initial = createExplorationSkills(createGameRandom(1), progression, catalog);
      const reward = { allocations: [{ characterId: "player", experience: 20 }] };
      let state = accepted(grantSkillExperience(initial, reward, progression, catalog));
      expect(state.growth.characters[0]).toMatchObject({
        level: finalLevel,
        experience: 0,
        pendingChoiceLevels: [milestone, finalLevel],
      });
      // seed 1 の先頭3抽選は、残り4・3・2件に対して添字0・1・1。
      expect(state.choice).toEqual({
        characterId: "player",
        level: milestone,
        status: "offered",
        candidateIds: [`${tier}-a`, `${tier}-c`, `${tier}-d`],
      });
      expect(state.characters[0].learned).toContainEqual({
        skillId: `${tier}-guaranteed`,
        type: "active",
        origin: "expedition",
        acquisition: "guaranteed",
      });
      expect(state.randomState).toBe(2165703038);
      const beforeFirstChoice = structuredClone(state);
      expect(prepareSkillChoice(state, catalog)).toEqual(beforeFirstChoice);
      expect(state).toEqual(beforeFirstChoice);
      const firstInput = {
        characterId: "player",
        level: milestone,
        skillId: `${tier}-a`,
      };
      state = accepted(chooseSkill(state, firstInput.skillId, catalog));
      expect(state.growth.characters[0].pendingChoiceLevels).toEqual([finalLevel]);
      expect(state.choice).toEqual({
        characterId: "player",
        level: finalLevel,
        status: "offered",
        candidateIds: ["normal-c", "normal-a", "normal-b"],
      });
      expect(state.randomState).toBe(1587069247);
      const beforeSecondChoice = structuredClone(state);
      expect(chooseSkill(state, firstInput.skillId, catalog)).toMatchObject({
        accepted: false,
        reason: "candidate-not-offered",
        state: beforeSecondChoice,
      });
      expect(state).toEqual(beforeSecondChoice);
      expect(prepareSkillChoice(state, catalog)).toEqual(beforeSecondChoice);
      expect(state).toEqual(beforeSecondChoice);
      const secondInput = { ...firstInput, level: finalLevel, skillId: "normal-c" };
      state = accepted(chooseSkill(state, secondInput.skillId, catalog));
      expect(state.choice).toBeNull();
      expect(state.growth.characters[0].pendingChoiceLevels).toEqual([]);
      expect(state.characters[0].learned.filter(({ acquisition }) => acquisition === "choice")).toEqual([
        { skillId: `${tier}-a`, type: "active", origin: "expedition", acquisition: "choice" },
        { skillId: "normal-c", type: "active", origin: "expedition", acquisition: "choice" },
      ]);
      expect(state.characters[0].learned.some(({ skillId }) => skillId === "normal-guaranteed")).toBe(false);
      const beforeReplay = structuredClone(state);
      expect(chooseSkill(state, secondInput.skillId, catalog)).toMatchObject({
        accepted: false,
        reason: "wrong-choice",
        state: beforeReplay,
      });
      expect(state).toEqual(beforeReplay);
    },
  );

  it.each(boundaries)(
    "$milestone のraw候補が7件でも有効候補2件なら、途中と次レベルの権利・乱数を保持する [%#]",
    ({ initialLevel, milestone, finalLevel, tier }) => {
      const { progression, catalog } = fixture(initialLevel, tier);
      const initial = createExplorationSkills(createGameRandom(1), progression, catalog);
      const state = accepted(
        grantSkillExperience(
          initial,
          { allocations: [{ characterId: "player", experience: 20 }] },
          progression,
          catalog,
        ),
      );
      expect(state.choice).toEqual({
        characterId: "player",
        level: milestone,
        status: "insufficient-candidates",
        candidateIds: [],
      });
      expect(state.growth.characters[0]).toMatchObject({
        level: finalLevel,
        pendingChoiceLevels: [milestone, finalLevel],
      });
      expect(state.randomState).toBe(1);
      const before = structuredClone(state);
      expect(chooseSkill(state, `${tier}-c`, catalog)).toMatchObject({
        accepted: false,
        reason: "wrong-choice",
        state: before,
      });
      expect(state).toEqual(before);
    },
  );
});
