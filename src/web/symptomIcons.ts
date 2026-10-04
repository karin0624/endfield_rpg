import type { CharacterStatus } from "../game/status";
import { projectSymptoms } from "../presentation/symptomProjection";

/** Native disclosures keep symptom meaning available to touch and keyboard users. */
export function renderSymptomIcons(root: HTMLElement, status: CharacterStatus, mentalFatigue: number): void {
  const descriptions = projectSymptoms(status, mentalFatigue);
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
