import type { BattleSkillRules } from "./battle";
import { equippedCharacters } from "./equipmentRuntime";
import type { ExpeditionGame } from "./expedition";
import type { CharacterDefinition } from "./party";
import type { ExperienceReward, ProgressionDefinition } from "./progression";
import { chooseSkill, createExplorationSkills, type ExplorationSkills, grantSkillExperience } from "./skillAcquisition";
import { passiveSkillAmount, skillById } from "./skills";
import { canParticipate, effectiveMaxHp, healthyStatus } from "./status";

export interface GrowthRules {
  readonly characters: readonly CharacterDefinition[];
  readonly progression: ProgressionDefinition;
  readonly battleExperience: number;
  readonly eventExperience: number;
  readonly townExperience: number;
}
export function hasPendingGrowth(game: ExpeditionGame): boolean {
  return game.growth?.growth.characters.some((entry) => entry.pendingChoiceLevels.length > 0) ?? false;
}
/** One temporary session spans town and departure; reset closes it on return. */
export function ensureGrowth(game: ExpeditionGame, rules: BattleSkillRules): ExpeditionGame {
  if (!rules.growth || (game.growth && !game.growth.closed)) return game;
  return {
    ...game,
    growth: createExplorationSkills(
      `growth:${game.clock?.nextActionId ?? 1}`,
      game.randomState ?? 1,
      rules.growth.progression,
      rules.catalog,
    ),
  };
}
export function growthStats(id: string, state: ExplorationSkills | undefined, rules: BattleSkillRules) {
  const growth = state?.growth.characters.find((entry) => entry.characterId === id);
  let maxHp = growth?.bonus.maxHp ?? 0;
  let attackPower = growth?.bonus.attackPower ?? 0;
  let basicAttackBonus = 0;
  for (const learned of state?.characters.find((entry) => entry.characterId === id)?.learned ?? []) {
    const skill = skillById(rules.catalog, learned.skillId);
    if (skill.type !== "passive" || learned.type !== "passive") continue;
    const amount = passiveSkillAmount(skill, learned.rank);
    if (skill.effect.type === "max-hp-bonus") maxHp += amount;
    else if (skill.effect.type === "attack-power-bonus") attackPower += amount;
    else basicAttackBonus += amount;
  }
  return { maxHp, attackPower, basicAttackBonus };
}
export function grownCharacters(game: ExpeditionGame, rules: BattleSkillRules): readonly CharacterDefinition[] {
  return equippedCharacters(game, rules.growth?.characters ?? []).map((character) => {
    const bonus = growthStats(character.id, game.growth, rules);
    return {
      ...character,
      maxHp: character.maxHp + bonus.maxHp,
      attackPower: character.attackPower + bonus.attackPower,
    };
  });
}
/** Adjust only HP's changed ceiling. Dead/ineligible members never revive through a projection. */
export function projectGrowth(
  game: ExpeditionGame,
  previous: ExplorationSkills | undefined,
  rules: BattleSkillRules,
): ExpeditionGame {
  if (!rules.growth) return game;
  const members = game.party.members.map((member) => {
    const base = equippedCharacters(game, rules.growth?.characters ?? []).find(({ id }) => id === member.id);
    if (!base) throw new Error("成長のキャラクター定義がありません");
    const status = member.status ?? healthyStatus();
    const before = effectiveMaxHp(base.maxHp + growthStats(member.id, previous, rules).maxHp, status);
    const after = effectiveMaxHp(base.maxHp + growthStats(member.id, game.growth, rules).maxHp, status);
    return {
      ...member,
      hp: Math.min(after, member.hp + (canParticipate(member.hp, status) ? Math.max(0, after - before) : 0)),
    };
  });
  const dungeon =
    game.dungeon === null
      ? null
      : {
          ...game.dungeon,
          randomState: game.randomState ?? game.dungeon.randomState,
          party: game.dungeon.party.map((participant) => {
            const base = equippedCharacters(game, rules.growth?.characters ?? []).find(
              ({ id }) => id === participant.id,
            );
            const member = members.find(({ id }) => id === participant.id);
            if (!base || !member) throw new Error("成長の参加者がありません");
            const bonus = growthStats(member.id, game.growth, rules);
            return {
              ...participant,
              hp: member.hp,
              maxHp: base.maxHp + bonus.maxHp,
              attackPower: base.attackPower + bonus.attackPower,
              basicAttackBonus: bonus.basicAttackBonus,
              learnedSkills:
                game.growth?.characters.find((entry) => entry.characterId === member.id)?.learned ??
                participant.learnedSkills,
            };
          }),
        };
  return { ...game, party: { ...game.party, members }, dungeon };
}
export function rewardGrowth(game: ExpeditionGame, reward: ExperienceReward, rules: BattleSkillRules) {
  const ready = ensureGrowth(game, rules);
  if (!ready.growth || !rules.growth) return { accepted: false, state: game, reason: "growth-unavailable" } as const;
  const result = grantSkillExperience(
    { ...ready.growth, randomState: ready.randomState ?? 1 },
    ready.growth.explorationId,
    reward,
    rules.growth.progression,
    rules.catalog,
  );
  if (!result.accepted) return { ...result, state: game };
  return {
    accepted: true,
    state: projectGrowth(
      { ...ready, growth: result.state, randomState: result.state.randomState },
      ready.growth,
      rules,
    ),
  } as const;
}
export function chooseGrowthSkill(game: ExpeditionGame, skillId: string, rules: BattleSkillRules) {
  if (!game.growth) return { accepted: false, state: game, reason: "growth-unavailable" } as const;
  const result = chooseSkill({ ...game.growth, randomState: game.randomState ?? 1 }, skillId, rules.catalog);
  if (!result.accepted) return { ...result, state: game };
  return {
    accepted: true,
    state: projectGrowth({ ...game, growth: result.state, randomState: result.state.randomState }, game.growth, rules),
  } as const;
}
