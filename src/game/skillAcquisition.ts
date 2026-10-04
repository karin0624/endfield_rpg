import { nextGameRandom } from "./gameRandom";
import {
  createExplorationGrowth,
  type ExperienceReward,
  type ExplorationGrowth,
  type GrowthRejection,
  grantExperience,
  type ProgressionDefinition,
  resetCharacterGrowth,
} from "./progression";
import {
  initialLearnedSkills,
  type LearnedSkill,
  type SkillCatalog,
  skillById,
  skillTierForLevel,
  validateSkillCatalog,
} from "./skills";

export interface CharacterSkills {
  readonly characterId: string;
  readonly learned: readonly LearnedSkill[];
}
export interface SkillChoice {
  readonly characterId: string;
  readonly level: number;
  readonly candidateIds: readonly string[];
  readonly status: "offered" | "insufficient-candidates";
}
/** Growth.pendingChoiceLevels is the sole ledger of unconsumed rights.
 * The single retained offer belongs to its first entry, never a second queue.
 */
export interface ExplorationSkills {
  /** The first completed town exploration grants XP once before return resets temporary growth. */
  readonly townExperienceClaimed: boolean;
  readonly closed: boolean;
  readonly growth: ExplorationGrowth;
  readonly characters: readonly CharacterSkills[];
  readonly choice: SkillChoice | null;
  readonly randomState: number;
}
export type AcquisitionResult =
  | { readonly accepted: true; readonly state: ExplorationSkills }
  | {
      readonly accepted: false;
      readonly state: ExplorationSkills;
      readonly reason:
        | GrowthRejection
        | "closed-exploration"
        | "pending-choice"
        | "wrong-choice"
        | "candidate-not-offered"
        | "ineligible-candidate";
    };

function learn(
  catalog: SkillCatalog,
  skillId: string,
  origin: LearnedSkill["origin"],
  acquisition: LearnedSkill["acquisition"],
): LearnedSkill {
  return skillById(catalog, skillId).type === "active"
    ? { skillId, type: "active", origin, acquisition }
    : { skillId, type: "passive", origin, acquisition, rank: 1 };
}
function initialSkills(catalog: SkillCatalog, characterId: string): CharacterSkills {
  return { characterId, learned: initialLearnedSkills(catalog, characterId) };
}

/** No product defaults: callers supply resolved initial skills and unlock tables. */
export function createExplorationSkills(
  randomState: number,
  progression: ProgressionDefinition,
  catalog: SkillCatalog,
): ExplorationSkills {
  if (!Number.isInteger(randomState) || randomState < 0 || randomState > 0xffffffff)
    throw new RangeError("乱数状態はuint32です");
  const growth = createExplorationGrowth(progression);
  validateSkillCatalog(
    catalog,
    catalog.characters.map(({ characterId }) => ({ id: characterId })),
  );
  for (const initial of progression.initial) {
    const profile = catalog.characters.find(({ characterId }) => characterId === initial.characterId);
    // Skills available at the initial level must be represented in initialSkillIds.
    if (profile?.guaranteedUnlocks?.some(({ level }) => level <= initial.level))
      throw new Error("保証解禁レベルは初期レベルより後です");
  }
  return {
    townExperienceClaimed: false,
    closed: false,
    growth,
    characters: growth.characters.map(({ characterId }) => initialSkills(catalog, characterId)),
    choice: null,
    randomState,
  };
}

function reject(
  state: ExplorationSkills,
  reason: Extract<AcquisitionResult, { accepted: false }>["reason"],
): AcquisitionResult {
  return { accepted: false, state, reason };
}
/** Generate once, only for the first right in definition character order, then level order.
 * Shortage consumes neither RNG nor the right. Repeated calls retain an existing offer.
 */
export function prepareSkillChoice(state: ExplorationSkills, catalog: SkillCatalog): ExplorationSkills {
  if (state.closed || state.choice?.status === "offered") return state;
  const character = state.growth.characters.find(({ pendingChoiceLevels }) => pendingChoiceLevels.length > 0);
  if (!character) return { ...state, choice: null };
  const level = character.pendingChoiceLevels[0];
  const profile = catalog.characters.find(({ characterId }) => characterId === character.characterId);
  const pool = catalog.pools.find(({ id }) => id === profile?.poolId);
  const learned = state.characters.find(({ characterId }) => characterId === character.characterId)?.learned;
  if (!profile || !pool || !learned) throw new Error("スキル対応がありません");
  const eligible = pool.candidates[skillTierForLevel(level)].filter((id) => {
    if (profile.guaranteedUnlocks?.some(({ skillId }) => skillId === id)) return false;
    const definition = skillById(catalog, id);
    const known = learned.find(({ skillId }) => skillId === id);
    return (
      !known ||
      (known.type === "passive" && definition.type === "passive" && known.rank < definition.effect.rankAmounts.length)
    );
  });
  if (eligible.length < 3)
    return {
      ...state,
      choice: { characterId: character.characterId, level, candidateIds: [], status: "insufficient-candidates" },
    };
  let randomState = state.randomState;
  const remaining = [...eligible];
  const candidateIds: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const draw = nextGameRandom(randomState);
    randomState = draw.state;
    const [id] = remaining.splice(Math.floor(draw.value * remaining.length), 1);
    candidateIds.push(id);
  }
  return {
    ...state,
    randomState,
    choice: { characterId: character.characterId, level, candidateIds, status: "offered" },
  };
}

/** Uses the existing atomic XP operation. Guarantees precede drawing and do not
 * consume a choice. All crossed levels are processed, not just the final level.
 */
export function grantSkillExperience(
  state: ExplorationSkills,
  reward: ExperienceReward,
  progression: ProgressionDefinition,
  catalog: SkillCatalog,
): AcquisitionResult {
  if (state.closed) return reject(state, "closed-exploration");
  if (state.growth.characters.some(({ pendingChoiceLevels }) => pendingChoiceLevels.length))
    return reject(state, "pending-choice");
  const growth = grantExperience(state.growth, reward, progression);
  if (!growth.accepted) return reject(state, growth.reason);
  const characters = state.characters.map((character) => {
    const profile = catalog.characters.find(({ characterId }) => characterId === character.characterId);
    if (!profile) throw new Error("キャラスキル定義がありません");
    const learned = [...character.learned];
    for (const reached of growth.levelsReached.filter(({ characterId }) => characterId === character.characterId)) {
      for (const unlock of profile.guaranteedUnlocks ?? []) {
        if (unlock.level === reached.level && !learned.some(({ skillId }) => skillId === unlock.skillId))
          learned.push(learn(catalog, unlock.skillId, "expedition", "guaranteed"));
      }
    }
    return { ...character, learned };
  });
  return { accepted: true, state: prepareSkillChoice({ ...state, growth: growth.state, characters }, catalog) };
}

export function chooseSkill(state: ExplorationSkills, skillId: string, catalog: SkillCatalog): AcquisitionResult {
  if (state.closed) return reject(state, "closed-exploration");
  const choice = state.choice;
  if (choice?.status !== "offered") return reject(state, "wrong-choice");
  if (!choice.candidateIds.includes(skillId)) return reject(state, "candidate-not-offered");
  const selected = skillById(catalog, skillId);
  const knownSelection = state.characters
    .find(({ characterId }) => characterId === choice.characterId)
    ?.learned.find((entry) => entry.skillId === skillId);
  if (
    knownSelection &&
    (knownSelection.type !== "passive" ||
      selected.type !== "passive" ||
      knownSelection.rank >= selected.effect.rankAmounts.length)
  )
    return reject(state, "ineligible-candidate");
  const characters = state.characters.map((character) => {
    if (character.characterId !== choice.characterId) return character;
    const known = character.learned.find((entry) => entry.skillId === skillId);
    const learned = known
      ? character.learned.map((entry) =>
          entry.skillId === skillId && entry.type === "passive" ? { ...entry, rank: entry.rank + 1 } : entry,
        )
      : [...character.learned, learn(catalog, skillId, "expedition", "choice")];
    return { ...character, learned };
  });
  const growth = {
    ...state.growth,
    characters: state.growth.characters.map((character) =>
      character.characterId === choice.characterId
        ? { ...character, pendingChoiceLevels: character.pendingChoiceLevels.slice(1) }
        : character,
    ),
  };
  return { accepted: true, state: prepareSkillChoice({ ...state, characters, growth, choice: null }, catalog) };
}

/** End temporary growth on return, keeping the confirmed RNG. */
export function resetExplorationSkills(
  state: ExplorationSkills,
  progression: ProgressionDefinition,
  catalog: SkillCatalog,
): AcquisitionResult {
  if (state.closed) return reject(state, "closed-exploration");
  const growth = resetCharacterGrowth(
    state.growth,
    state.characters.map(({ characterId }) => characterId),
    progression,
  );
  if (!growth.accepted) return reject(state, growth.reason);
  return {
    accepted: true,
    state: {
      ...state,
      closed: true,
      growth: growth.state,
      characters: state.characters.map(({ characterId }) => initialSkills(catalog, characterId)),
      choice: null,
    },
  };
}
