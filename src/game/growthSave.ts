import type { BattleSkillRules } from "./battle";
import type { CharacterGrowth } from "./progression";
import { type CharacterSkills, createExplorationSkills, type ExplorationSkills } from "./skillAcquisition";
import { type LearnedSkill, skillTierForLevel } from "./skills";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, names: string[]): boolean {
  return Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
}
/** Stable town state only. Rebuild typed records and check earned levels, bonuses,
 * ownership, caps, guarantees and consumed choice counts against current definitions. */
export function parseSavedGrowth(
  value: unknown,
  rules: BattleSkillRules,
  randomState: number,
): ExplorationSkills | undefined {
  if (
    !Number.isInteger(randomState) ||
    randomState < 0 ||
    randomState > 0xffffffff ||
    !rules.growth ||
    !record(value) ||
    !keys(value, ["explorationId", "closed", "growth", "characters", "choice", "randomState"]) ||
    typeof value.explorationId !== "string" ||
    !/^(growth|expedition):[1-9]\d*$/.test(value.explorationId) ||
    typeof value.closed !== "boolean" ||
    value.choice !== null ||
    value.randomState !== randomState
  )
    return;
  const initial = createExplorationSkills(value.explorationId, randomState, rules.growth.progression, rules.catalog);
  if (
    !record(value.growth) ||
    !keys(value.growth, ["characters", "appliedRewardIds"]) ||
    !Array.isArray(value.growth.characters) ||
    !Array.isArray(value.growth.appliedRewardIds) ||
    !value.growth.appliedRewardIds.every((id) => typeof id === "string" && id.trim()) ||
    new Set(value.growth.appliedRewardIds).size !== value.growth.appliedRewardIds.length ||
    !Array.isArray(value.characters) ||
    value.characters.length !== initial.characters.length ||
    value.growth.characters.length !== initial.characters.length
  )
    return;
  const growth: CharacterGrowth[] = [];
  const characters: CharacterSkills[] = [];
  for (const [index, base] of initial.growth.characters.entries()) {
    const entry: unknown = value.growth.characters[index];
    const skills: unknown = value.characters[index];
    if (
      !record(entry) ||
      !keys(entry, ["characterId", "level", "experience", "bonus", "pendingChoiceLevels"]) ||
      entry.characterId !== base.characterId ||
      typeof entry.level !== "number" ||
      !Number.isSafeInteger(entry.level) ||
      entry.level < base.level ||
      typeof entry.experience !== "number" ||
      !Number.isSafeInteger(entry.experience) ||
      entry.experience < 0 ||
      !record(entry.bonus) ||
      !keys(entry.bonus, ["maxHp", "attackPower"]) ||
      !Array.isArray(entry.pendingChoiceLevels) ||
      entry.pendingChoiceLevels.length !== 0 ||
      !record(skills) ||
      !keys(skills, ["characterId", "learned"]) ||
      skills.characterId !== base.characterId ||
      !Array.isArray(skills.learned)
    )
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
      if (!record(item) || typeof item.skillId !== "string" || ids.has(item.skillId)) return;
      ids.add(item.skillId);
      const definition = rules.catalog.skills.find(({ id }) => id === item.skillId);
      if (
        !definition ||
        item.type !== definition.type ||
        !keys(
          item,
          definition.type === "active"
            ? ["skillId", "type", "origin", "acquisition"]
            : ["skillId", "type", "origin", "acquisition", "rank"],
        )
      )
        return;
      const isInitial = profile.initialSkillIds?.includes(item.skillId);
      const guarantee = profile.guaranteedUnlocks?.find(({ skillId }) => skillId === item.skillId);
      const rank = definition.type === "passive" ? item.rank : 1;
      if (
        typeof rank !== "number" ||
        !Number.isSafeInteger(rank) ||
        rank < 1 ||
        (definition.type === "passive" && rank > definition.effect.rankAmounts.length)
      )
        return;
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
    explorationId: value.explorationId,
    closed: value.closed,
    growth: { characters: growth, appliedRewardIds: [...value.growth.appliedRewardIds] },
    characters,
    choice: null,
    randomState,
  };
}
