import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { mentalFatigueLabel, mentalFatigueMultiplier } from "../game/mentalFatigue";
import type { CharacterStatus } from "../game/status";
import { formatAmount, symptomDescriptions } from "./statusText";

export type SymptomKind = "physicalFatigue" | "haze" | "incapacity" | "mentalFatigue";
export interface SymptomFrame {
  readonly kind: SymptomKind;
  readonly icon: string;
  readonly label: string;
  readonly detail: string;
  readonly open: boolean;
}
export function projectSymptoms(
  status: CharacterStatus,
  mentalFatigue: number,
  open: readonly SymptomKind[] = [],
): readonly SymptomFrame[] {
  const descriptions: Omit<SymptomFrame, "open">[] = [...symptomDescriptions(status)];
  if (mentalFatigue > 0)
    descriptions.push({
      kind: "mentalFatigue",
      icon: "精",
      label: `精神疲労・${mentalFatigueLabel(mentalFatigue, mentalFatigueDefinition)}`,
      detail: `負荷付きスキル効果 × ${formatAmount(mentalFatigueMultiplier(mentalFatigue, mentalFatigueDefinition) * 100)}%（あと街探索${Math.ceil(mentalFatigue / mentalFatigueDefinition.townRecovery)}回）`,
    });
  return descriptions.map((description) => ({ ...description, open: open.includes(description.kind) }));
}
