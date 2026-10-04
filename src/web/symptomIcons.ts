import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { mentalFatigueLabel, mentalFatigueMultiplier } from "../game/mentalFatigue";
import type { CharacterStatus } from "../game/status";
import { formatAmount, symptomDescriptions } from "../presentation/statusText";

/** Native disclosures keep symptom meaning available to touch and keyboard users. */
export function renderSymptomIcons(root: HTMLElement, status: CharacterStatus, mentalFatigue: number): void {
  const descriptions = [...symptomDescriptions(status)];
  if (mentalFatigue > 0)
    descriptions.push({
      icon: "精",
      label: `精神疲労・${mentalFatigueLabel(mentalFatigue, mentalFatigueDefinition)}`,
      detail: `負荷付きスキル効果 × ${formatAmount(mentalFatigueMultiplier(mentalFatigue, mentalFatigueDefinition) * 100)}%（あと街探索${Math.ceil(mentalFatigue / mentalFatigueDefinition.townRecovery)}回）`,
    });
  root.replaceChildren();
  root.classList.add("symptom-icons");
  for (const { icon, label, detail } of descriptions) {
    const disclosure = document.createElement("details");
    disclosure.className = "symptom-icon";
    const summary = document.createElement("summary");
    const mark = document.createElement("span");
    mark.className = "symptom-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = icon;
    const name = document.createElement("span");
    name.textContent = label;
    summary.append(mark, name);
    const description = document.createElement("span");
    description.className = "symptom-description";
    description.textContent = detail;
    disclosure.append(summary, description);
    root.append(disclosure);
  }
  root.hidden = descriptions.length === 0;
}
