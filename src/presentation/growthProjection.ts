import type { ExplorationSkills } from "../game/skillAcquisition";
import { type SkillCatalog, skillById } from "../game/skills";

/** The confirmed offer is read without drawing, advancing, or learning. */
export function projectGrowthChoice(
  state: ExplorationSkills,
  catalog: SkillCatalog,
  names: Readonly<Record<string, string>>,
) {
  const choice = state.choice;
  if (!choice) return null;
  const growth = state.growth.characters.find(({ characterId }) => characterId === choice.characterId);
  const learned = state.characters.find(({ characterId }) => characterId === choice.characterId)?.learned ?? [];
  const guaranteed = learned.filter(({ acquisition }) => acquisition === "guaranteed");
  return {
    title: `${names[choice.characterId] ?? choice.characterId} · Lv${choice.level} スキル選択`,
    summary: `現在Lv${growth?.level} · 余剰XP ${growth?.experience} · 1つ選ぶと続行します。成長・習得は帰還時に初期化されます。`,
    guaranteed: guaranteed.length
      ? `レベル保証で習得：${guaranteed.map(({ skillId }) => skillById(catalog, skillId).name).join("、")}（探索中のみ）`
      : "",
    error:
      choice.status === "offered" ? "" : "有効な3候補が不足しています。選択権利を保持したまま進行を停止しています。",
    candidates: choice.candidateIds.map((skillId) => {
      const skill = skillById(catalog, skillId);
      const known = learned.find((entry) => entry.skillId === skillId);
      return {
        skillId,
        name: skill.name,
        description: skill.description,
        detail:
          skill.type === "active"
            ? `新規アクティブ · 精神疲労 +${skill.mentalFatigueIncrease} · ${skill.scenes.map((scene) => (scene === "battle" ? "戦闘" : "分岐")).join("／")}`
            : `パッシブ ${known?.type === "passive" ? `強化 ${known.rank}→${known.rank + 1}` : "習得 0→1"} / 上限${skill.effect.rankAmounts.length}`,
      };
    }),
  };
}
export type GrowthFrame = NonNullable<ReturnType<typeof projectGrowthChoice>>;
