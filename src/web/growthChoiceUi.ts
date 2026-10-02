import type { ExplorationSkills } from "../game/skillAcquisition";
import { type SkillCatalog, skillById } from "../game/skills";

/** The retained core offer is the only source of choices; rendering never draws. */
export function mountGrowthChoice(
  root: HTMLElement,
  state: ExplorationSkills,
  catalog: SkillCatalog,
  names: Readonly<Record<string, string>>,
  choose: (input: { explorationId: string; characterId: string; level: number; skillId: string }) => void,
): () => void {
  const choice = state.choice;
  if (!choice) return () => {};
  const events = new AbortController();
  root.replaceChildren();
  const panel = document.createElement("section");
  panel.className = "growth-choice";
  panel.setAttribute("aria-label", "レベルアップのスキル選択");
  const title = document.createElement("h1");
  title.textContent = `${names[choice.characterId] ?? choice.characterId} · Lv${choice.level} スキル選択`;
  title.tabIndex = -1;
  const summary = document.createElement("p");
  const growth = state.growth.characters.find(({ characterId }) => characterId === choice.characterId);
  summary.textContent = `現在Lv${growth?.level} · 余剰XP ${growth?.experience} · 1つ選ぶと続行します。成長・習得は帰還時に初期化されます。`;
  panel.append(title, summary);
  const learned = state.characters.find(({ characterId }) => characterId === choice.characterId)?.learned ?? [];
  const guaranteed = learned.filter(({ acquisition }) => acquisition === "guaranteed");
  if (guaranteed.length) {
    const notice = document.createElement("p");
    notice.textContent = `レベル保証で習得：${guaranteed.map(({ skillId }) => skillById(catalog, skillId).name).join("、")}（探索中のみ）`;
    panel.append(notice);
  }
  if (choice.status !== "offered") {
    const error = document.createElement("p");
    error.textContent = "有効な3候補が不足しています。選択権利を保持したまま進行を停止しています。";
    error.setAttribute("role", "alert");
    panel.append(error);
  }
  for (const skillId of choice.candidateIds) {
    const skill = skillById(catalog, skillId);
    const known = learned.find((entry) => entry.skillId === skillId);
    const button = document.createElement("button");
    button.type = "button";
    const name = document.createElement("strong");
    name.textContent = skill.name;
    const detail = document.createElement("span");
    detail.className = "growth-choice-detail";
    detail.textContent =
      skill.type === "active"
        ? `新規アクティブ · 精神疲労 +${skill.mentalFatigueIncrease} · ${skill.scenes.map((scene) => (scene === "battle" ? "戦闘" : "分岐")).join("／")}`
        : `パッシブ ${known?.type === "passive" ? `強化 ${known.rank}→${known.rank + 1}` : "習得 0→1"} / 上限${skill.effect.rankAmounts.length}`;
    const description = document.createElement("span");
    description.className = "growth-choice-detail";
    description.textContent = skill.description;
    button.append(name, detail, description);
    button.addEventListener(
      "click",
      () =>
        choose({ explorationId: state.explorationId, characterId: choice.characterId, level: choice.level, skillId }),
      { signal: events.signal },
    );
    panel.append(button);
  }
  root.append(panel);
  title.focus();
  return () => events.abort();
}
