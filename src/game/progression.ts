export interface GrowthBonus {
  readonly maxHp: number;
  readonly attackPower: number;
}
export interface InitialCharacterGrowth {
  readonly characterId: string;
  readonly level: number;
  /** Surplus toward the next level, not lifetime experience. */
  readonly experience: number;
  readonly bonus: GrowthBonus;
}
export interface LevelGrowthRule {
  readonly fromLevel: number;
  readonly requiredExperience: number;
  readonly bonus: GrowthBonus;
}
/** Caller-authored settings; no default level, XP curve or distribution. */
export interface ProgressionDefinition {
  readonly initial: readonly InitialCharacterGrowth[];
  readonly rules: readonly LevelGrowthRule[];
}
export interface CharacterGrowth extends InitialCharacterGrowth {
  /** One pending choice for each reached level; no drawing or learning here. */
  readonly pendingChoiceLevels: readonly number[];
}
export interface ExplorationGrowth {
  readonly characters: readonly CharacterGrowth[];
  readonly appliedRewardIds: readonly string[];
}
export interface ExperienceReward {
  /** Unique within this growth session, including distinct visits to a node. */
  readonly id: string;
  /** Explicit recipient allocations; the core does not infer eligibility. */
  readonly allocations: readonly { readonly characterId: string; readonly experience: number }[];
}
export interface LevelReached {
  readonly characterId: string;
  readonly level: number;
}
export type GrowthRejection =
  | "invalid-reward-id"
  | "reward-already-applied"
  | "unknown-character"
  | "duplicate-character"
  | "invalid-experience"
  | "missing-level-rule"
  | "numeric-overflow";
export type GrowthResult =
  | { readonly accepted: true; readonly state: ExplorationGrowth; readonly levelsReached: readonly LevelReached[] }
  | { readonly accepted: false; readonly state: ExplorationGrowth; readonly reason: GrowthRejection };

function validAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
/** Integer XP is this core's supported input domain, not a balance default. */
function validExperience(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function validLevel(level: number): boolean {
  return Number.isSafeInteger(level) && level >= 1;
}
function validBonus(bonus: GrowthBonus): boolean {
  return validAmount(bonus.maxHp) && validAmount(bonus.attackPower);
}
export function validateProgressionDefinition(definition: ProgressionDefinition): void {
  if (new Set(definition.initial.map(({ characterId }) => characterId)).size !== definition.initial.length)
    throw new Error("初期成長のキャラクターIDが重複しています");
  if (new Set(definition.rules.map(({ fromLevel }) => fromLevel)).size !== definition.rules.length)
    throw new Error("成長ルールのレベルが重複しています");
  for (const rule of definition.rules) {
    if (
      !validLevel(rule.fromLevel) ||
      !Number.isSafeInteger(rule.requiredExperience) ||
      rule.requiredExperience <= 0 ||
      !validBonus(rule.bonus)
    )
      throw new Error("成長ルールが不正です");
  }
  for (const initial of definition.initial) {
    if (
      !initial.characterId.trim() ||
      !validLevel(initial.level) ||
      !validExperience(initial.experience) ||
      !validBonus(initial.bonus)
    )
      throw new Error("初期成長が不正です");
    if (initial.experience > 0) {
      const rule = definition.rules.find(({ fromLevel }) => fromLevel === initial.level);
      if (!rule || initial.experience >= rule.requiredExperience)
        throw new Error("初期経験値は定義された次レベルの必要量未満です");
    }
  }
}
export function createExplorationGrowth(definition: ProgressionDefinition): ExplorationGrowth {
  validateProgressionDefinition(definition);
  return {
    characters: definition.initial.map((initial) => ({
      ...initial,
      bonus: { ...initial.bonus },
      pendingChoiceLevels: [],
    })),
    appliedRewardIds: [],
  };
}

/** Atomic XP operation shared by callers of any reward source.
 * Neither this state nor this operation owns HP, symptoms, party slots or RNG.
 */
export function grantExperience(
  state: ExplorationGrowth,
  reward: ExperienceReward,
  definition: ProgressionDefinition,
): GrowthResult {
  validateProgressionDefinition(definition);
  const reject = (reason: GrowthRejection): GrowthResult => ({ accepted: false, state, reason });
  if (!reward.id.trim()) return reject("invalid-reward-id");
  if (state.appliedRewardIds.includes(reward.id)) return reject("reward-already-applied");
  const ids = reward.allocations.map(({ characterId }) => characterId);
  if (new Set(ids).size !== ids.length) return reject("duplicate-character");
  if (ids.some((id) => !state.characters.some(({ characterId }) => characterId === id)))
    return reject("unknown-character");
  if (reward.allocations.some(({ experience }) => !validExperience(experience))) return reject("invalid-experience");

  const characters: CharacterGrowth[] = [];
  const levelsReached: LevelReached[] = [];
  for (const character of state.characters) {
    const allocation = reward.allocations.find(({ characterId }) => characterId === character.characterId);
    if (!allocation || allocation.experience === 0) {
      characters.push(character);
      continue;
    }
    let experience = character.experience + allocation.experience;
    let level = character.level;
    let bonus = { ...character.bonus };
    const choices = [...character.pendingChoiceLevels];
    if (!validExperience(experience)) return reject("numeric-overflow");
    while (experience > 0) {
      const rule = definition.rules.find(({ fromLevel }) => fromLevel === level);
      // Missing data is not an implicit level cap or XP sink.
      if (!rule) return reject("missing-level-rule");
      if (experience < rule.requiredExperience) break;
      experience -= rule.requiredExperience;
      level += 1;
      bonus = { maxHp: bonus.maxHp + rule.bonus.maxHp, attackPower: bonus.attackPower + rule.bonus.attackPower };
      if (!validLevel(level) || !validBonus(bonus)) return reject("numeric-overflow");
      choices.push(level);
      levelsReached.push({ characterId: character.characterId, level });
    }
    characters.push({ ...character, level, experience, bonus, pendingChoiceLevels: choices });
  }
  return {
    accepted: true,
    state: { characters, appliedRewardIds: [...state.appliedRewardIds, reward.id] },
    levelsReached,
  };
}

/** Reset only explicitly selected growth records. Reward receipts remain consumed
 * within this session; a new session starts via createExplorationGrowth.
 * Choosing return recipients and resetting learned skills belong to callers.
 */
export function resetCharacterGrowth(
  state: ExplorationGrowth,
  characterIds: readonly string[],
  definition: ProgressionDefinition,
): GrowthResult {
  validateProgressionDefinition(definition);
  if (new Set(characterIds).size !== characterIds.length)
    return { accepted: false, state, reason: "duplicate-character" };
  if (
    characterIds.some(
      (id) =>
        !state.characters.some(({ characterId }) => characterId === id) ||
        !definition.initial.some(({ characterId }) => characterId === id),
    )
  )
    return { accepted: false, state, reason: "unknown-character" };
  return {
    accepted: true,
    state: {
      ...state,
      characters: state.characters.map((character) => {
        if (!characterIds.includes(character.characterId)) return character;
        const initial = definition.initial.find(({ characterId }) => characterId === character.characterId);
        if (!initial) throw new Error("初期成長がありません");
        return { ...initial, bonus: { ...initial.bonus }, pendingChoiceLevels: [] };
      }),
    },
    levelsReached: [],
  };
}
