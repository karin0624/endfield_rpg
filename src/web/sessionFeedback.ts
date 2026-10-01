import type { CharacterRecoveryChange, GameActionCompletion } from "../game/expedition";
import { type CharacterDefinition, characterById } from "../game/party";
import type { CharacterStatus } from "../game/status";
import { type ActionClock, createActionClock, getCalendar } from "../game/time";

const severity = ["なし", "軽度", "中度", "重度"];
export function calendarLabel(clock: ActionClock = createActionClock()): string {
  const calendar = getCalendar(clock);
  return `${calendar.day}日目 · ${calendar.period === "day" ? "昼" : "夜"}`;
}
export function symptomLabel(status: CharacterStatus): string {
  return [
    status.physicalFatigue
      ? `肉体疲労・${severity[status.physicalFatigue]}（あと街探索${status.physicalFatigue}回）`
      : "",
    status.haze ? `朦朧・${severity[status.haze]}（あと街探索${status.haze}回）` : "",
    status.incapacityRecoverySteps === null ? "" : `戦闘不能（あと街探索${status.incapacityRecoverySteps}回）`,
  ]
    .filter(Boolean)
    .join(" / ");
}
function recoveryLabel(change: CharacterRecoveryChange): string {
  const { before, after } = change;
  return [
    ...(["physicalFatigue", "haze"] as const).map((kind) =>
      before[kind] === after[kind]
        ? ""
        : `${kind === "physicalFatigue" ? "肉体疲労" : "朦朧"}：${severity[before[kind]]} → ${severity[after[kind]]}${after[kind] ? `（あと街探索${after[kind]}回）` : ""}`,
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
