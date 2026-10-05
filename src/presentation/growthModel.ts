import type { SkillChoice } from "../game/skillAcquisition";

export type GrowthFocus =
  | { readonly kind: "heading" }
  | { readonly kind: "candidate"; readonly skillId: string }
  | null;
export type GrowthEvent =
  | { readonly type: "choose"; readonly skillId: string }
  | { readonly type: "focused"; readonly target: Exclude<GrowthFocus, null> }
  | { readonly type: "key"; readonly key: string; readonly shift: boolean };

/** A mandatory current offer owns focus; browser activation still produces a single meaning event. */
export function reduceGrowthPresentation(
  focus: GrowthFocus,
  event: Exclude<GrowthEvent, { type: "choose" }>,
  choice: SkillChoice | null,
) {
  const ignored = { focus, handled: false };
  if (!choice) return ignored;
  if (event.type === "focused")
    return event.target.kind === "heading" || choice.candidateIds.includes(event.target.skillId)
      ? { focus: event.target, handled: true }
      : ignored;
  if (event.key !== "Tab" || !choice.candidateIds.length) return ignored;
  const index = focus?.kind === "candidate" ? choice.candidateIds.indexOf(focus.skillId) : -1;
  const next =
    index < 0
      ? event.shift
        ? choice.candidateIds.length - 1
        : 0
      : (index + (event.shift ? -1 : 1) + choice.candidateIds.length) % choice.candidateIds.length;
  return { focus: { kind: "candidate" as const, skillId: choice.candidateIds[next] }, handled: true };
}
