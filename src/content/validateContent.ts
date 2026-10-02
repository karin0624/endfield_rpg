import { type AdventureDefinition, assertValidAdventureDefinition } from "../game/adventure";
import type { InitialGameOptions } from "../game/createInitialGameState";
import { assertValidDungeonDefinition, type DungeonDefinition } from "../game/dungeon";
import type { GrowthRules } from "../game/growthRuntime";
import { type CharacterDefinition, createParty, getPartyCombatants } from "../game/party";
import type { SaveDefinitions } from "../game/save";
import { createExplorationSkills } from "../game/skillAcquisition";
import { type SkillCatalog, validateSkillCatalog } from "../game/skills";
import { characters } from "./characters";
import { growthRules } from "./growthRules";
import { initialAdventure } from "./initialAdventure";
import { initialDungeon } from "./initialDungeon";
import { initialGameOptions } from "./initialGameOptions";
import { saveDefinitions } from "./saveDefinitions";
import { skillCatalog } from "./skillDefinitions";

export interface ContentDefinitions {
  readonly characters: readonly CharacterDefinition[];
  readonly adventure: AdventureDefinition;
  readonly dungeon: DungeonDefinition;
  readonly initial: InitialGameOptions;
  readonly growth: GrowthRules;
  readonly skills: SkillCatalog;
  readonly save: SaveDefinitions;
}

export const contentDefinitions: ContentDefinitions = {
  characters,
  adventure: initialAdventure,
  dungeon: initialDungeon,
  initial: initialGameOptions,
  growth: growthRules,
  skills: skillCatalog,
  save: saveDefinitions,
};

/** npm run check の本番定義テストから呼ぶ。個別の形式検証は既存APIへ委譲する。 */
export function validateContent(content: ContentDefinitions): void {
  const { characters: roster, adventure, dungeon, initial, growth, skills, save } = content;
  const party = createParty(
    roster,
    roster.map(({ id }) => id),
  );
  assertValidAdventureDefinition(adventure);
  // 編成の初期枠は先頭1人だけ。控えを含めた全員と敵のID衝突も既存検証へ渡す。
  const combatants = roster.flatMap(({ id }) =>
    getPartyCombatants({ ...party, slots: [id, null, null, null] }, roster),
  );
  assertValidDungeonDefinition(dungeon, adventure, combatants);
  validateSkillCatalog(skills, roster);
  const ids = new Set(roster.map(({ id }) => id));
  for (const [label, references] of [
    ["初期成長", growth.progression.initial.map(({ characterId }) => characterId)],
    ["成長名簿", growth.characters.map(({ id }) => id)],
    ["保存名簿", save.characters.map(({ id }) => id)],
  ] as const) {
    for (const id of references) {
      if (!ids.has(id)) throw new Error(`${label}のキャラクター参照がありません: ${id}`);
    }
    for (const id of ids) {
      if (!references.includes(id)) throw new Error(`${label}がありません: ${id}`);
    }
  }
  for (const id of ids) {
    const profile = skills.characters.find(({ characterId }) => characterId === id);
    if (!profile || profile.initialSkillIds === null) throw new Error(`初期スキル定義が未接続です: ${id}`);
  }
  // progression・初期習得・保証解禁レベルの整合も公開の生成APIで検証する。
  createExplorationSkills("content-validation", 1, growth.progression, skills);
  for (const key of ["battleExperience", "eventExperience", "townExperience"] as const) {
    if (!Number.isSafeInteger(growth[key]) || growth[key] < 0)
      throw new Error(`経験値報酬は安全な非負整数です: ${key}=${growth[key]}`);
  }
  const placeIds = new Set(adventure.places.map(({ id }) => id));
  if (!placeIds.has(initial.startingPlaceId)) throw new Error(`開始場所がありません: ${initial.startingPlaceId}`);
  for (const id of save.placeIds) {
    if (!placeIds.has(id)) throw new Error(`保存の場所参照がありません: ${id}`);
  }
  for (const id of placeIds) {
    if (!save.placeIds.includes(id)) throw new Error(`保存対象の場所がありません: ${id}`);
  }
  const recruitments = adventure.conversations.flatMap((conversation) =>
    Object.entries(conversation.nodes).flatMap(([nodeId, node]) =>
      node.type === "end"
        ? (node.recruitments ?? []).map((effect) => ({ effect, location: `${conversation.id}/${nodeId}` }))
        : [],
    ),
  );
  const flags = save.recruitmentFlags ?? [];
  for (const { effect, location } of recruitments) {
    if (!ids.has(effect.characterId))
      throw new Error(`加入キャラクター参照がありません: ${location}/${effect.characterId}`);
    if (!flags.some(({ flag, characterId }) => characterId === effect.characterId && effect.setFlags?.includes(flag)))
      throw new Error(`加入イベントの保存フラグ対応がありません: ${location}/${effect.characterId}`);
  }
  for (const { flag, characterId } of flags) {
    if (!ids.has(characterId)) throw new Error(`保存加入フラグのキャラクター参照がありません: ${flag}/${characterId}`);
    if (!recruitments.some(({ effect }) => effect.characterId === characterId && effect.setFlags?.includes(flag)))
      throw new Error(`保存加入フラグに対応するイベントがありません: ${flag}/${characterId}`);
  }
}
