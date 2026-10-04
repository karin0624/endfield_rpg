import type { BattleSkillRules } from "../game/battle";
import type { CharacterDefinition } from "../game/party";
import type { ExplorationSkills } from "../game/skillAcquisition";
import {
  initialLearnedSkills,
  type LearnedSkill,
  mentalFatigueAffectedQuantity,
  passiveSkillAmount,
  type SkillCatalog,
  skillById,
} from "../game/skills";
import { formatAmount } from "./statusText";

/** Supplied anew on every open; reading never initializes a growth session. */
export interface CharacterDetailsContext {
  readonly characters: readonly CharacterDefinition[];
  readonly baseCharacters: readonly CharacterDefinition[];
  readonly growth: ExplorationSkills | undefined;
  readonly rules: BattleSkillRules;
}

export function characterLearning(id: string, context: CharacterDetailsContext) {
  const { growth, rules } = context;
  const profile = rules.catalog.characters.find((entry) => entry.characterId === id);
  const level = growth
    ? growth.growth.characters.find((entry) => entry.characterId === id)?.level
    : rules.growth?.progression.initial.find((entry) => entry.characterId === id)?.level;
  const learned = growth
    ? growth.characters.find((entry) => entry.characterId === id)?.learned
    : profile?.initialSkillIds != null
      ? initialLearnedSkills(rules.catalog, id)
      : undefined;
  return { level, learned };
}

export function learnedSkillText(catalog: SkillCatalog, learned: LearnedSkill) {
  const skill = skillById(catalog, learned.skillId);
  const lifetime = learned.origin === "initial" ? "初期習得" : "探索中のみ（帰還で失う）";
  const route =
    learned.acquisition === "guaranteed" ? "レベル保証で習得" : learned.acquisition === "choice" ? "選択で習得" : "";
  const notes = [skill.description, [lifetime, route].filter(Boolean).join(" · ")];
  if (skill.type === "passive" && learned.type === "passive") {
    const effect = {
      "basic-attack-power-bonus": "通常攻撃のみの威力補正",
      "attack-power-bonus": "攻撃力",
      "max-hp-bonus": "症状前の最大HP",
    }[skill.effect.type];
    notes.push(`現在の効果：${effect} +${formatAmount(passiveSkillAmount(skill, learned.rank))}`);
    if (learned.origin === "initial" && learned.rank > 1)
      notes.push("探索中のランク強化分は帰還で初期ランクに戻ります。");
    return {
      name: skill.name,
      kind: `パッシブ · ランク ${learned.rank} / 上限 ${skill.effect.rankAmounts.length}`,
      notes,
    };
  }
  if (skill.type === "active") {
    notes.push(
      `${skill.scenes.map((scene) => (scene === "battle" ? "戦闘" : "分岐")).join("／")} · ${skill.target === "all-enemies" ? "生存中の敵全体" : skill.target === "single-enemy" ? "生存中の敵1体" : "生存中の味方1体（自分を含む）"} · 精神疲労 +${formatAmount(skill.mentalFatigueIncrease)}`,
    );
    if (skill.effect.type === "damage")
      notes.push(`対象ごとに最大${skill.effect.hitCount ?? 1}回攻撃（撃破時は打切り）。`);
    if (mentalFatigueAffectedQuantity(skill))
      notes.push("効果量は使用前の精神疲労で減衰します。効果適用後に精神疲労が増加します。");
  }
  return { name: skill.name, kind: "アクティブ", notes };
}
