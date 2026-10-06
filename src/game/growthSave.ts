import * as v from "valibot";
import type { BattleSkillRules } from "./battle";
import type { CharacterGrowth } from "./progression";
import { nonnegativeInteger, nonnegativeNumber, positiveInteger, savedRandomState } from "./saveFormat";
import { type CharacterSkills, createExplorationSkills, type ExplorationSkills } from "./skillAcquisition";
import { type LearnedSkill, skillTierForLevel } from "./skills";

const learnedFields = {
  skillId: v.string(),
  origin: v.picklist(["initial", "expedition"]),
  acquisition: v.picklist(["initial", "guaranteed", "choice"]),
};
export const savedGrowth = v.strictObject({
  townExperienceClaimed: v.boolean(),
  closed: v.boolean(),
  growth: v.strictObject({
    characters: v.array(
      v.strictObject({
        characterId: v.string(),
        level: positiveInteger,
        experience: nonnegativeInteger,
        bonus: v.strictObject({ maxHp: nonnegativeNumber, attackPower: nonnegativeNumber }),
        pendingChoiceLevels: v.strictTuple([]),
      }),
    ),
  }),
  characters: v.array(
    v.strictObject({
      characterId: v.string(),
      learned: v.array(
        v.variant("type", [
          v.strictObject({ ...learnedFields, type: v.literal("active") }),
          v.strictObject({ ...learnedFields, type: v.literal("passive"), rank: positiveInteger }),
        ]),
      ),
    }),
  ),
  choice: v.null(),
  randomState: savedRandomState,
});
/** Stable town state only. Rebuild typed records and check earned levels, bonuses,
 * ownership, caps, guarantees and consumed choice counts against current definitions. */
export function restoreSavedGrowth(
  value: v.InferOutput<typeof savedGrowth>,
  rules: BattleSkillRules,
  randomState: number,
): ExplorationSkills | undefined {
  if (!rules.growth || value.randomState !== randomState) return;
  const initial = createExplorationSkills(randomState, rules.growth.progression, rules.catalog);
  if (
    value.characters.length !== initial.characters.length ||
    value.growth.characters.length !== initial.characters.length
  )
    return;
  const growth: CharacterGrowth[] = [];
  const characters: CharacterSkills[] = [];
  for (const [index, base] of initial.growth.characters.entries()) {
    const entry = value.growth.characters[index];
    const skills = value.characters[index];
    if (entry.characterId !== base.characterId || entry.level < base.level || skills.characterId !== base.characterId)
      return;
    const level = entry.level;
    const bonus = { ...base.bonus };
    const counts = { normal: 0, advanced: 0, ultimate: 0 };
    // A saved level cannot exceed the authored finite progression table.
    if (entry.level > base.level + rules.growth.progression.rules.length) return;
    for (let level = base.level; level < entry.level; level++) {
      const rule = rules.growth.progression.rules.find(({ fromLevel }) => fromLevel === level);
      if (!rule) return;
      bonus.maxHp += rule.bonus.maxHp;
      bonus.attackPower += rule.bonus.attackPower;
      counts[skillTierForLevel(level + 1)]++;
    }
    const next = rules.growth.progression.rules.find(({ fromLevel }) => fromLevel === entry.level);
    if (
      (entry.experience > 0 && (!next || entry.experience >= next.requiredExperience)) ||
      entry.bonus.maxHp !== bonus.maxHp ||
      entry.bonus.attackPower !== bonus.attackPower
    )
      return;
    const profile = rules.catalog.characters.find(({ characterId }) => characterId === base.characterId);
    const pool = rules.catalog.pools.find(({ id }) => id === profile?.poolId);
    if (!profile || !pool) return;
    const learned: LearnedSkill[] = [];
    const ids = new Set<string>();
    for (const item of skills.learned) {
      if (ids.has(item.skillId)) return;
      ids.add(item.skillId);
      const definition = rules.catalog.skills.find(({ id }) => id === item.skillId);
      if (!definition || item.type !== definition.type) return;
      const isInitial = profile.initialSkillIds?.includes(item.skillId);
      const guarantee = profile.guaranteedUnlocks?.find(({ skillId }) => skillId === item.skillId);
      const rank = item.type === "passive" ? item.rank : 1;
      if (definition.type === "passive" && rank > definition.effect.rankAmounts.length) return;
      if (isInitial) {
        if (item.origin !== "initial" || item.acquisition !== "initial") return;
        counts[definition.tier] -= rank - 1;
      } else if (guarantee) {
        if (guarantee.level > entry.level || item.origin !== "expedition" || item.acquisition !== "guaranteed") return;
      } else {
        if (
          item.origin !== "expedition" ||
          item.acquisition !== "choice" ||
          !pool.candidates[definition.tier].includes(item.skillId)
        )
          return;
        counts[definition.tier] -= rank;
      }
      const origin = isInitial ? "initial" : "expedition";
      const acquisition = isInitial ? "initial" : guarantee ? "guaranteed" : "choice";
      learned.push(
        definition.type === "active"
          ? { skillId: item.skillId, type: "active", origin, acquisition }
          : { skillId: item.skillId, type: "passive", origin, acquisition, rank },
      );
    }
    if (
      Object.values(counts).some((count) => count !== 0) ||
      profile.initialSkillIds?.some((id) => !ids.has(id)) ||
      profile.guaranteedUnlocks?.some(({ skillId, level: unlockedAt }) => unlockedAt <= level && !ids.has(skillId))
    )
      return;
    if (value.closed && (entry.level !== base.level || entry.experience !== base.experience)) return;
    growth.push({
      characterId: base.characterId,
      level: entry.level,
      experience: entry.experience,
      bonus,
      pendingChoiceLevels: [],
    });
    characters.push({ characterId: base.characterId, learned });
  }
  return {
    townExperienceClaimed: value.townExperienceClaimed,
    closed: value.closed,
    growth: { characters: growth },
    characters,
    choice: null,
    randomState,
  };
}
