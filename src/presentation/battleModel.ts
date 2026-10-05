import { itemCatalog, recoveryItemId } from "../content/itemSettings";
import type { BattleSkillRules, BattleState } from "../game/battle";
import { previewRecoveryItem } from "../game/itemUse";
import { skillById } from "../game/skills";
import { canParticipate } from "../game/status";
import { type PartyAnchorMeasure, type PartyMeasurement, projectPartyAnchor } from "./battlePlacement";
import {
  type BattlePlayback,
  type BattlePlaybackEvent,
  type ConfirmedBattleRecord,
  createBattlePlayback,
  reduceBattlePlayback,
} from "./battlePlayback";
import { projectSymptoms, type SymptomKind } from "./symptomProjection";

export type BattleFocus =
  | {
      readonly kind:
        | "attack"
        | "skills"
        | "use-skill"
        | "cancel-skill"
        | "ally-target"
        | "item"
        | "item-target"
        | "item-use"
        | "item-back"
        | "speed"
        | "skip"
        | "finish";
    }
  | { readonly kind: "enemy"; readonly id: string }
  | { readonly kind: "skill"; readonly id: string }
  | { readonly kind: "symptom"; readonly id: string; readonly symptom: SymptomKind };
export interface BattleInput {
  /** The application's current game owns this value; playback snapshots are display only. */
  readonly battle: BattleState | null;
  readonly rules?: BattleSkillRules;
  readonly basicAttack: boolean;
  readonly itemCount: number;
  readonly items: boolean;
  /** Native camera depth is a measurement. Choosing the living target is model logic. */
  readonly enemyDepths: readonly { readonly id: string; readonly depth: number }[];
}
export type BattleSelectionPanel =
  | { readonly kind: "commands" }
  | { readonly kind: "skills"; readonly skillId: string | null; readonly allyId: string | null };
export interface BattleModel {
  readonly scene: {
    /** Identifies this actual renderer lifetime, never an input opportunity. */
    readonly owner: number;
    readonly status: "loading" | "ready" | "error" | "closed";
    readonly reason: string;
  };
  readonly panel:
    | BattleSelectionPanel
    | {
        readonly kind: "item";
        readonly targetId: string | null;
        readonly message: string;
        readonly returnPanel: BattleSelectionPanel;
      };
  readonly selectedEnemyId: string | null;
  readonly playback: BattlePlayback;
  readonly focus: BattleFocus | null;
  readonly afterPlaybackFocus: BattleFocus | null;
  readonly disclosures: readonly { readonly id: string; readonly symptom: SymptomKind }[];
  readonly message: string;
  readonly targetAnnouncement: "prompt" | "selected";
  readonly markerElapsedMs: number;
  /** Preserve the HP baseline at a given native width/font while symptoms grow below it. */
  readonly partyAnchor: PartyAnchorMeasure | null;
  /** The visible input prompt held until the first confirmed impact. */
  readonly actionPrompt: { readonly enemyId: string | null; readonly selected: boolean } | null;
}
export type BattleCommand =
  | { readonly type: "attack"; readonly actorId: string; readonly targetId: string }
  | { readonly type: "skill"; readonly actorId: string; readonly targetId: string | null; readonly skillId: string }
  | { readonly type: "item"; readonly actorId: string; readonly targetId: string; readonly itemId: string }
  | { readonly type: "finish" };
export type BattleModelEvent =
  | { readonly type: "party-measured"; readonly measure: PartyMeasurement }
  | { readonly type: "scene-ready"; readonly owner: number }
  | { readonly type: "scene-error"; readonly owner: number; readonly reason: string }
  | { readonly type: "select-enemy"; readonly id: string }
  | {
      readonly type:
        | "open-skills"
        | "cancel-skills"
        | "use-skill"
        | "attack"
        | "open-item"
        | "cancel-item"
        | "use-item"
        | "finish"
        | "closed";
    }
  | { readonly type: "select-skill"; readonly id: string }
  | { readonly type: "select-ally" | "select-item-target"; readonly id: string }
  | { readonly type: "focused"; readonly target: BattleFocus }
  | { readonly type: "key"; readonly key: string; readonly shift: boolean }
  | { readonly type: "toggle-symptom"; readonly id: string; readonly symptom: SymptomKind }
  | { readonly type: "playback"; readonly event: BattlePlaybackEvent };
export interface BattleTransition {
  readonly state: BattleModel;
  readonly handled: boolean;
  /** The parent applies this core command synchronously before accepting the next event. */
  readonly command?: BattleCommand;
  /** The enclosing screen chooses its preceding/following meaning focus target. */
  readonly focusExit?: "previous" | "next";
}

function livingEnemy(input: BattleInput, id: string | null): boolean {
  return (
    input.battle?.combatants.some((member) => member.id === id && member.team === "enemy" && member.isAlive) ?? false
  );
}
export function frontmostBattleEnemy(input: BattleInput): string | null {
  const candidates = input.battle?.combatants.filter((member) => member.team === "enemy" && member.isAlive) ?? [];
  const measured = input.enemyDepths
    .filter((entry) => entry.depth >= 0 && candidates.some((member) => member.id === entry.id))
    .sort((first, second) => first.depth - second.depth);
  return measured[0]?.id ?? null;
}
export function battleCanAct(
  state: Pick<BattleModel, "scene"> & { readonly playback: Pick<BattlePlayback, "phase"> },
  input: BattleInput,
): boolean {
  const battle = input.battle;
  return (
    state.scene.status === "ready" &&
    state.playback.phase === "finished" &&
    battle?.outcome === "ongoing" &&
    battle.combatants.some(
      (member) =>
        member.id === battle.currentActorId && member.team === "ally" && canParticipate(member.hp, member.status),
    )
  );
}
export function battleSkills(input: BattleInput) {
  const actor = input.battle?.combatants.find((member) => member.id === input.battle?.currentActorId);
  const catalog = input.rules?.catalog;
  if (!catalog) return [];
  return (actor?.learnedSkills ?? [])
    .map((known) => skillById(catalog, known.skillId))
    .filter((skill) => skill.type === "active")
    .filter((skill) => skill.scenes.includes("battle"));
}
export function battleSelectedSkill(state: Pick<BattleModel, "panel">, input: BattleInput) {
  const panel = state.panel.kind === "item" ? state.panel.returnPanel : state.panel;
  if (panel.kind !== "skills") return undefined;
  return battleSkills(input).find((skill) => skill.id === panel.skillId);
}
export function battleMarkerTarget(
  state: Pick<BattleModel, "scene" | "panel" | "selectedEnemyId"> & {
    readonly playback: Pick<BattlePlayback, "phase">;
  },
  input: BattleInput,
): string | null {
  const skill = battleSelectedSkill(state, input);
  return battleCanAct(state, input) &&
    livingEnemy(input, state.selectedEnemyId) &&
    (!skill || skill.target === "single-enemy")
    ? state.selectedEnemyId
    : null;
}
export function battleItemUsable(
  state: Pick<BattleModel, "scene" | "panel"> & { readonly playback: Pick<BattlePlayback, "phase"> },
  input: BattleInput,
): boolean {
  const panel = state.panel;
  return (
    panel.kind === "item" &&
    input.itemCount > 0 &&
    battleCanAct(state, input) &&
    previewRecoveryItem(
      input.battle?.combatants.find((member) => member.id === panel.targetId),
      recoveryItemId,
      itemCatalog,
    ).usable
  );
}
export function createBattleModel(
  record: ConfirmedBattleRecord,
  owner: number,
  speed: 0 | 1 | 2 = 1,
  reduced = false,
): BattleModel {
  return {
    scene: { owner, status: "loading", reason: "" },
    panel: { kind: "commands" },
    selectedEnemyId: null,
    playback: createBattlePlayback(record, speed, reduced),
    focus: null,
    afterPlaybackFocus: null,
    disclosures: [],
    message: "",
    targetAnnouncement: "prompt",
    markerElapsedMs: 0,
    partyAnchor: null,
    actionPrompt: null,
  };
}
function completionFocus(state: BattleModel, input: BattleInput): BattleFocus | null {
  if (state.playback.record.after.outcome !== "ongoing") return { kind: "finish" };
  if (state.afterPlaybackFocus?.kind === "item" && input.itemCount === 0)
    return { kind: input.rules ? "skills" : "attack" };
  return state.afterPlaybackFocus;
}
function focusOrder(state: BattleModel, input: BattleInput): readonly BattleFocus[] {
  if (state.panel.kind === "item")
    return [
      { kind: "item-target" },
      ...(battleItemUsable(state, input) ? [{ kind: "item-use" as const }] : []),
      { kind: "item-back" },
    ];
  const canAct = battleCanAct(state, input);
  const skill = battleSelectedSkill(state, input);
  return [
    ...(canAct && skill?.target !== "all-enemies"
      ? (input.battle?.combatants
          .filter((member) => member.team === "enemy" && member.isAlive)
          .map((member) => ({ kind: "enemy" as const, id: member.id })) ?? [])
      : []),
    ...(canAct && state.panel.kind === "commands" && input.basicAttack && livingEnemy(input, state.selectedEnemyId)
      ? [{ kind: "attack" as const }]
      : []),
    ...(canAct && state.panel.kind === "commands" && input.rules ? [{ kind: "skills" as const }] : []),
    ...(canAct && state.panel.kind === "skills"
      ? [
          ...battleSkills(input).map((entry) => ({ kind: "skill" as const, id: entry.id })),
          ...(skill?.target === "single-ally" ? [{ kind: "ally-target" as const }] : []),
          ...(skill ? [{ kind: "use-skill" as const }] : []),
          { kind: "cancel-skill" as const },
        ]
      : []),
    ...(input.rules || state.playback.phase !== "finished" ? [{ kind: "speed" as const }] : []),
    ...(state.playback.phase !== "finished" ? [{ kind: "skip" as const }] : []),
    ...(canAct && input.items && input.itemCount > 0 ? [{ kind: "item" as const }] : []),
    ...state.playback.display.combatants
      .filter((member) => member.team === "ally")
      .flatMap((member) =>
        projectSymptoms(member.status, member.mentalFatigue).map((symptom) => ({
          kind: "symptom" as const,
          id: member.id,
          symptom: symptom.kind,
        })),
      ),
    ...(state.playback.phase === "finished" && state.playback.record.after.outcome !== "ongoing"
      ? [{ kind: "finish" as const }]
      : []),
  ];
}
export function battleBoundaryFocus(state: BattleModel, input: BattleInput, boundary: "first" | "last") {
  const order = focusOrder(state, input);
  return (boundary === "first" ? order[0] : order.at(-1)) ?? null;
}
const focusEqual = (first: BattleFocus | null, second: BattleFocus) =>
  first?.kind === second.kind &&
  (!("id" in first) || ("id" in second && first.id === second.id)) &&
  (!("symptom" in first) || ("symptom" in second && first.symptom === second.symptom));

export function reduceBattleModel(state: BattleModel, input: BattleInput, event: BattleModelEvent): BattleTransition {
  const result = (next = state, handled = true, command?: BattleCommand): BattleTransition => ({
    state: next,
    handled,
    command,
  });
  if (state.scene.status === "closed") return result(state, false);
  if (event.type === "closed")
    return result({
      ...state,
      scene: { ...state.scene, status: "closed" },
      playback: reduceBattlePlayback(state.playback, { type: "close" }),
      focus: null,
    });
  if (event.type === "party-measured") {
    const partyAnchor = projectPartyAnchor(state.partyAnchor, event.measure);
    return result(partyAnchor === state.partyAnchor ? state : { ...state, partyAnchor });
  }
  if (event.type === "scene-ready" || event.type === "scene-error") {
    if (event.owner !== state.scene.owner || state.scene.status !== "loading") return result(state, false);
    return result({
      ...state,
      scene: {
        ...state.scene,
        status: event.type === "scene-ready" ? "ready" : "error",
        reason: event.type === "scene-error" ? event.reason : "",
      },
      selectedEnemyId: frontmostBattleEnemy(input),
    });
  }
  if (event.type === "playback") {
    if (event.event.type === "advance" && state.scene.status !== "ready") return result(state, false);
    const playback = reduceBattlePlayback(state.playback, event.event);
    const markerElapsedMs =
      event.event.type === "advance" && !state.playback.reducedMotion && battleMarkerTarget(state, input) !== null
        ? state.markerElapsedMs + event.event.elapsedMs
        : state.markerElapsedMs;
    const next = { ...state, playback, markerElapsedMs };
    return result({
      ...next,
      focus:
        playback.phase === "finished" && state.playback.phase !== "finished"
          ? completionFocus(next, input)
          : state.focus,
    });
  }
  if (event.type === "focused")
    return result(focusEqual(state.focus, event.target) ? state : { ...state, focus: event.target });
  if (event.type === "toggle-symptom") {
    const open = state.disclosures.some((entry) => entry.id === event.id && entry.symptom === event.symptom);
    return result({
      ...state,
      disclosures: open
        ? state.disclosures.filter((entry) => entry.id !== event.id || entry.symptom !== event.symptom)
        : [...state.disclosures, { id: event.id, symptom: event.symptom }],
    });
  }
  if (event.type === "key") {
    if (event.key === "Escape")
      return state.panel.kind === "item"
        ? reduceBattleModel(state, input, { type: "cancel-item" })
        : state.panel.kind === "skills"
          ? reduceBattleModel(state, input, { type: "cancel-skills" })
          : result(state, false);
    if (event.key !== "Tab") return result(state, false);
    const order = focusOrder(state, input);
    const index = order.findIndex((target) => focusEqual(state.focus, target));
    const nextIndex = index < 0 ? (event.shift ? order.length - 1 : 0) : index + (event.shift ? -1 : 1);
    if (state.panel.kind !== "item" && (nextIndex < 0 || nextIndex >= order.length))
      return { state, handled: true, focusExit: event.shift ? "previous" : "next" };
    return result({ ...state, focus: order[(nextIndex + order.length) % order.length] });
  }
  if (event.type === "finish")
    return state.playback.phase === "finished" && state.playback.record.after.outcome !== "ongoing"
      ? result(state, true, { type: "finish" })
      : result(state, false);
  if (!battleCanAct(state, input)) return result(state, false);
  if (event.type === "select-enemy") {
    const skill = battleSelectedSkill(state, input);
    if (state.panel.kind === "item" || !livingEnemy(input, event.id) || (skill && skill.target !== "single-enemy"))
      return result(state, false);
    return result({ ...state, selectedEnemyId: event.id, targetAnnouncement: "selected", message: "" });
  }
  if (event.type === "open-skills" && state.panel.kind === "commands" && input.rules)
    return result({
      ...state,
      panel: { kind: "skills", skillId: null, allyId: input.battle?.currentActorId ?? null },
      focus: battleSkills(input)[0] ? { kind: "skill", id: battleSkills(input)[0].id } : { kind: "cancel-skill" },
    });
  if (event.type === "cancel-skills" && state.panel.kind === "skills")
    return result({ ...state, panel: { kind: "commands" }, focus: { kind: "skills" } });
  if (
    event.type === "select-skill" &&
    state.panel.kind === "skills" &&
    battleSkills(input).some((skill) => skill.id === event.id)
  )
    return result({ ...state, panel: { ...state.panel, skillId: event.id }, focus: { kind: "skill", id: event.id } });
  if (
    event.type === "select-ally" &&
    state.panel.kind === "skills" &&
    input.battle?.combatants.some(
      (member) => member.id === event.id && member.team === "ally" && canParticipate(member.hp, member.status),
    )
  )
    return result({ ...state, panel: { ...state.panel, allyId: event.id } });
  if (event.type === "open-item" && state.panel.kind !== "item" && input.items && input.itemCount > 0)
    return result({
      ...state,
      panel: {
        kind: "item",
        targetId: input.battle?.combatants.find((member) => member.team === "ally")?.id ?? null,
        message: "",
        returnPanel: state.panel,
      },
      focus: { kind: "item-target" },
    });
  if (event.type === "cancel-item" && state.panel.kind === "item")
    return result({ ...state, panel: state.panel.returnPanel, focus: { kind: "item" } });
  if (
    event.type === "select-item-target" &&
    state.panel.kind === "item" &&
    input.battle?.combatants.some((member) => member.id === event.id && member.team === "ally")
  )
    return result({ ...state, panel: { ...state.panel, targetId: event.id, message: "" } });
  const actorId = input.battle?.currentActorId;
  if (
    event.type === "attack" &&
    state.panel.kind === "commands" &&
    input.basicAttack &&
    actorId &&
    livingEnemy(input, state.selectedEnemyId)
  )
    return result(state, true, { type: "attack", actorId, targetId: state.selectedEnemyId as string });
  if (event.type === "use-skill" && state.panel.kind === "skills" && actorId) {
    const skill = battleSelectedSkill(state, input);
    if (!skill) return result(state, false);
    const targetId =
      skill.target === "single-ally"
        ? state.panel.allyId
        : skill.target === "single-enemy"
          ? state.selectedEnemyId
          : null;
    if (skill.target !== "all-enemies" && !targetId) return result(state, false);
    return result(state, true, { type: "skill", actorId, targetId, skillId: skill.id });
  }
  if (event.type === "use-item" && state.panel.kind === "item" && actorId && battleItemUsable(state, input))
    return result(state, true, {
      type: "item",
      actorId,
      targetId: state.panel.targetId as string,
      itemId: recoveryItemId,
    });
  return result(state, false);
}

/** Called in the same application transition as the core operation, never after an await. */
export function confirmBattleAction(
  state: BattleModel,
  input: BattleInput,
  result:
    | { readonly accepted: true; readonly record: ConfirmedBattleRecord }
    | { readonly accepted: false; readonly reason: string },
): BattleModel {
  if (!result.accepted)
    return state.panel.kind === "item"
      ? { ...state, panel: { ...state.panel, message: "使用できませんでした。対象と所持数を確認してください。" } }
      : { ...state, message: `使用できませんでした：${result.reason}` };
  const afterPlaybackFocus: BattleFocus = {
    kind: state.panel.kind === "item" ? "item" : state.panel.kind === "skills" ? "skills" : "attack",
  };
  const next = {
    ...state,
    panel: { kind: "commands" as const },
    playback: createBattlePlayback(result.record, state.playback.requestedSpeed, state.playback.reducedMotion),
    selectedEnemyId: livingEnemy(input, state.selectedEnemyId) ? state.selectedEnemyId : frontmostBattleEnemy(input),
    afterPlaybackFocus,
    focus: null,
    actionPrompt: { enemyId: state.selectedEnemyId, selected: state.targetAnnouncement === "selected" },
    targetAnnouncement: "prompt" as const,
    message: "",
  };
  return next.playback.phase === "finished" ? { ...next, focus: completionFocus(next, input) } : next;
}
