import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import type { CharacterRecoveryChange, GameActionCompletion } from "../game/expedition";
import { type LoadSymptomKind, loadSymptomLabel, loadSymptomMultiplier } from "../game/loadSymptoms";
import { mentalFatigueLabel } from "../game/mentalFatigue";
import { type CharacterDefinition, characterById } from "../game/party";
import type { CharacterStatus } from "../game/status";
import { symptomRecoverySteps } from "../game/status";
import { type ActionClock, createActionClock, getCalendar } from "../game/time";

export const formatAmount = (value: number): string => String(Number(value.toFixed(2)));
export const mentalFatigueText = (value: number): string =>
  `${formatAmount(value)}（${mentalFatigueLabel(value, mentalFatigueDefinition)}）`;
export const symptomNames = { physicalFatigue: "肉体疲労", haze: "朦朧" } as const;
export function loadSymptomText(kind: LoadSymptomKind, value: number): string {
  return `${formatAmount(value)}（${loadSymptomLabel(value, loadSymptomDefinition.symptoms[kind])}）`;
}
export function symptomDescriptions(
  status: CharacterStatus,
): readonly { icon: string; label: string; detail: string }[] {
  const symptoms = (["physicalFatigue", "haze"] as const)
    .filter((kind) => status[kind] > 0)
    .map((kind) => {
      const definition = loadSymptomDefinition.symptoms[kind];
      const penalty = `${kind === "physicalFatigue" ? "最大HP" : "命中率"} × ${formatAmount(loadSymptomMultiplier(status[kind], definition) * 100)}%`;
      return {
        icon: kind === "physicalFatigue" ? "体" : "朦",
        label: `${symptomNames[kind]}・${loadSymptomLabel(status[kind], definition)}`,
        detail: `${penalty}（あと街探索${symptomRecoverySteps(status[kind], kind)}回）`,
      };
    });
  if (status.incapacityRecoverySteps !== null)
    symptoms.push({
      icon: "休",
      label: "戦闘不能",
      detail: `戦闘参加不可（あと街探索${status.incapacityRecoverySteps}回）`,
    });
  return symptoms;
}
export function calendarLabel(clock: ActionClock = createActionClock()): string {
  const calendar = getCalendar(clock);
  return `${calendar.day}日目 · ${calendar.period === "day" ? "昼" : "夜"}`;
}
export function symptomLabel(status: CharacterStatus): string {
  return symptomDescriptions(status)
    .map(({ label, detail }) => `${label} · ${detail}`)
    .join(" / ");
}
function recoveryLabel(change: CharacterRecoveryChange): string {
  const { before, after } = change;
  return [
    change.mentalFatigueBefore !== undefined &&
    change.mentalFatigueAfter !== undefined &&
    change.mentalFatigueBefore !== change.mentalFatigueAfter
      ? `精神疲労：${formatAmount(change.mentalFatigueBefore)} → ${mentalFatigueText(change.mentalFatigueAfter)}`
      : "",
    ...(["physicalFatigue", "haze"] as const).map((kind) =>
      before[kind] === after[kind]
        ? ""
        : `${symptomNames[kind]}：${formatAmount(before[kind])} → ${loadSymptomText(kind, after[kind])}${after[kind] ? `（あと街探索${change.remainingSteps[kind]}回）` : ""}`,
    ),
    before.incapacityRecoverySteps === after.incapacityRecoverySteps
      ? ""
      : after.incapacityRecoverySteps === null
        ? "戦闘不能から復帰"
        : `戦闘不能：あと街探索${before.incapacityRecoverySteps}回 → ${after.incapacityRecoverySteps}回`,
  ]
    .filter(Boolean)
    .join(" / ");
}
export function completionFeedback(
  completion: GameActionCompletion | undefined,
  characters: readonly CharacterDefinition[],
): readonly string[] {
  if (!completion) return [];
  if (completion.returnedIds) return ["出撃者のHPが全回復しました。"];
  return completion.recovery.flatMap((change) => {
    const text = recoveryLabel(change);
    return text ? [`${characterById(characters, change.id).name} · ${text}`] : [];
  });
}
