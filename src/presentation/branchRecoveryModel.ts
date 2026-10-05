import { itemCatalog, recoveryItemId } from "../content/itemSettings";
import type { BattleSkillRules } from "../game/battle";
import type { DungeonCommand, ExpeditionGame } from "../game/expedition";
import { bagItemQuantity } from "../game/items";
import { previewRecoveryItem } from "../game/itemUse";
import { canParticipate } from "../game/status";

export interface BranchRecoveryInput {
  readonly game: ExpeditionGame;
  readonly rules?: BattleSkillRules;
  readonly items: boolean;
}
export type BranchFocus =
  | { readonly kind: "skill-trigger" | "item-trigger" | "cancel" | "item-target" | "item-use" }
  | { readonly kind: "actor" | "skill" | "target"; readonly id: string };
export interface BranchRecoveryModel {
  readonly panel:
    | { readonly kind: "closed" | "actor" }
    | { readonly kind: "skill"; readonly actorId: string }
    | { readonly kind: "target"; readonly actorId: string; readonly skillId: string }
    | { readonly kind: "item"; readonly targetId: string | null };
  readonly focus: BranchFocus | null;
}
export type BranchRecoveryEvent =
  | { readonly type: "open-skill" | "open-item" | "cancel" | "use-item" }
  | { readonly type: "actor" | "skill" | "target" | "item-target"; readonly id: string }
  | { readonly type: "focused"; readonly target: BranchFocus }
  | { readonly type: "key"; readonly key: string; readonly shift: boolean };
export function createBranchRecovery(): BranchRecoveryModel {
  return { panel: { kind: "closed" }, focus: null };
}
export function branchItemCount(input: BranchRecoveryInput): number {
  return input.game.inventory ? bagItemQuantity(input.game.inventory.items, recoveryItemId) : 0;
}
export function branchActors(input: BranchRecoveryInput) {
  return input.game.dungeon?.party.filter((member) => canParticipate(member.hp, member.status)) ?? [];
}
export function branchSkills(input: BranchRecoveryInput, actorId: string) {
  const known = branchActors(input).find(({ id }) => id === actorId)?.learnedSkills ?? [];
  return (
    input.rules?.catalog.skills.filter(
      (skill) =>
        skill.type === "active" &&
        skill.scenes.includes("branch") &&
        skill.effect.type === "hp-recovery" &&
        known.some((entry) => entry.type === "active" && entry.skillId === skill.id),
    ) ?? []
  );
}
export function branchItemUsable(state: BranchRecoveryModel, input: BranchRecoveryInput): boolean {
  const panel = state.panel;
  return (
    panel.kind === "item" &&
    branchItemCount(input) > 0 &&
    previewRecoveryItem(
      input.game.dungeon?.party.find(({ id }) => id === panel.targetId),
      recoveryItemId,
      itemCatalog,
    ).usable
  );
}
export function branchFocusOrder(state: BranchRecoveryModel, input: BranchRecoveryInput): readonly BranchFocus[] {
  const panel = state.panel;
  if (panel.kind === "closed")
    return [
      ...(input.rules ? [{ kind: "skill-trigger" as const }] : []),
      ...(input.items && branchItemCount(input) > 0 ? [{ kind: "item-trigger" as const }] : []),
    ];
  if (panel.kind === "item")
    return [
      { kind: "item-target" },
      ...(branchItemUsable(state, input) ? [{ kind: "item-use" as const }] : []),
      { kind: "cancel" },
    ];
  return [
    ...(panel.kind === "actor"
      ? branchActors(input).map(({ id }) => ({ kind: "actor" as const, id }))
      : panel.kind === "skill"
        ? branchSkills(input, panel.actorId).map(({ id }) => ({ kind: "skill" as const, id }))
        : branchActors(input).map(({ id }) => ({ kind: "target" as const, id }))),
    { kind: "cancel" },
  ];
}
export function reduceBranchRecovery(
  state: BranchRecoveryModel,
  input: BranchRecoveryInput,
  event: BranchRecoveryEvent,
) {
  const result = (next = state, handled = true, command?: DungeonCommand) => ({ state: next, handled, command });
  const ignored = () => result(state, false);
  const panel = state.panel;
  if (event.type === "focused") {
    return branchFocusOrder(state, input).some((target) => JSON.stringify(target) === JSON.stringify(event.target))
      ? result({ ...state, focus: event.target })
      : ignored();
  }
  if (panel.kind === "closed") {
    if (event.type === "open-skill" && input.rules) {
      const opened: BranchRecoveryModel = { panel: { kind: "actor" }, focus: null };
      return result({ ...opened, focus: branchFocusOrder(opened, input)[0] });
    }
    if (event.type === "open-item" && input.items && branchItemCount(input) > 0)
      return result({
        panel: { kind: "item", targetId: input.game.dungeon?.party[0]?.id ?? null },
        focus: { kind: "item-target" },
      });
    return ignored();
  }
  if (event.type === "cancel" || (event.type === "key" && event.key === "Escape"))
    return result({
      panel: { kind: "closed" },
      focus: { kind: panel.kind === "item" ? "item-trigger" : "skill-trigger" },
    });
  if (event.type === "key") {
    if (event.key !== "Tab") return ignored();
    const order = branchFocusOrder(state, input);
    const current = order.findIndex((target) => JSON.stringify(target) === JSON.stringify(state.focus));
    const index =
      current < 0
        ? event.shift
          ? order.length - 1
          : 0
        : (current + (event.shift ? -1 : 1) + order.length) % order.length;
    return result({ ...state, focus: order[index] });
  }
  if (panel.kind === "item") {
    if (event.type === "item-target" && input.game.dungeon?.party.some(({ id }) => id === event.id))
      return result({ ...state, panel: { ...panel, targetId: event.id } });
    return event.type === "use-item" && panel.targetId && branchItemUsable(state, input)
      ? result(state, true, { type: "branch-item", itemId: recoveryItemId, targetId: panel.targetId })
      : ignored();
  }
  if (panel.kind === "actor" && event.type === "actor" && branchActors(input).some(({ id }) => id === event.id)) {
    const next: BranchRecoveryModel = { panel: { kind: "skill", actorId: event.id }, focus: null };
    return result({ ...next, focus: branchFocusOrder(next, input)[0] });
  }
  if (
    panel.kind === "skill" &&
    event.type === "skill" &&
    branchSkills(input, panel.actorId).some(({ id }) => id === event.id)
  ) {
    const next: BranchRecoveryModel = {
      panel: { kind: "target", actorId: panel.actorId, skillId: event.id },
      focus: null,
    };
    return result({ ...next, focus: branchFocusOrder(next, input)[0] });
  }
  return panel.kind === "target" && event.type === "target" && branchActors(input).some(({ id }) => id === event.id)
    ? result(state, true, { type: "branch-skill", actorId: panel.actorId, skillId: panel.skillId, targetId: event.id })
    : ignored();
}
