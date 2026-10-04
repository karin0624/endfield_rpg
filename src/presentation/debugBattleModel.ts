import {
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  type BattleState,
  createBattleState,
  performBasicAttackAndAdvanceToAllyInput,
} from "../game/battle";
import {
  type BattleInput,
  type BattleModel,
  type BattleModelEvent,
  battleBoundaryFocus,
  confirmBattleAction,
  createBattleModel,
  reduceBattleModel,
} from "./battleModel";
import { projectBattleActors } from "./battleProjection";
import { projectBattleView } from "./battleViewProjection";

export interface DebugBattleInput {
  readonly combatants: readonly BattleCombatantDefinition[];
  readonly enemyDepths: BattleInput["enemyDepths"];
  readonly editor: boolean;
}
export interface DebugBattleModel {
  readonly battle: BattleState;
  readonly view: BattleModel;
  readonly utilityFocus: "town" | "editor" | null;
}
export type DebugBattleEvent =
  | BattleModelEvent
  | { readonly type: "utility-focused"; readonly target: "town" | "editor" };
export type DebugBattleEffect =
  | { readonly type: "replace-scene"; readonly owner: number }
  | { readonly type: "close-scene" };
export interface DebugBattleTransition {
  readonly state: DebugBattleModel;
  readonly effects: readonly DebugBattleEffect[];
  readonly handled: boolean;
}
export function debugBattleInput(state: DebugBattleModel, input: DebugBattleInput): BattleInput {
  return { battle: state.battle, enemyDepths: input.enemyDepths, basicAttack: true, items: false, itemCount: 0 };
}
export function createDebugBattleModel(input: DebugBattleInput, owner = 0, reducedMotion = false): DebugBattleModel {
  const before = createBattleState(input.combatants);
  const opening = advanceBattleToNextAllyInput(before);
  return {
    battle: opening.state,
    view: createBattleModel({ before, after: opening.state, events: opening.events }, owner, 1, reducedMotion),
    utilityFocus: null,
  };
}
export function reduceDebugBattle(
  state: DebugBattleModel,
  input: DebugBattleInput,
  event: DebugBattleEvent,
): DebugBattleTransition {
  if (state.view.scene.status === "closed") return { state, effects: [], handled: false };
  if (event.type === "utility-focused")
    return {
      state: { ...state, view: { ...state.view, focus: null }, utilityFocus: event.target },
      effects: [],
      handled: true,
    };
  if (event.type === "key" && event.key === "Tab" && state.utilityFocus) {
    if (state.utilityFocus === "town" && event.shift)
      return {
        state: {
          ...state,
          utilityFocus: null,
          view: { ...state.view, focus: battleBoundaryFocus(state.view, debugBattleInput(state, input), "last") },
        },
        effects: [],
        handled: true,
      };
    const target =
      state.utilityFocus === "town" && input.editor && !event.shift
        ? "editor"
        : state.utilityFocus === "editor" && event.shift
          ? "town"
          : null;
    return { state: { ...state, utilityFocus: target }, effects: [], handled: target !== null };
  }
  const transition = reduceBattleModel(state.view, debugBattleInput(state, input), event);
  let next = transition.state === state.view ? state : { ...state, view: transition.state };
  if (event.type === "closed") next = { ...next, utilityFocus: null };
  if (event.type === "focused") next = { ...next, utilityFocus: null };
  if (transition.focusExit)
    next = {
      ...next,
      view: { ...next.view, focus: null },
      utilityFocus: transition.focusExit === "next" ? "town" : null,
    };
  const effects: DebugBattleEffect[] = [];
  if (event.type === "closed" && transition.handled) effects.push({ type: "close-scene" });
  if (event.type === "scene-error" && transition.handled) effects.push({ type: "close-scene" });
  if (transition.command?.type === "attack") {
    const command = transition.command;
    const committed = performBasicAttackAndAdvanceToAllyInput(state.battle, command.actorId, command.targetId);
    const battle = committed.state;
    next = {
      ...next,
      battle,
      view: confirmBattleAction(
        transition.state,
        debugBattleInput({ ...next, battle }, input),
        committed.accepted
          ? { accepted: true, record: { before: state.battle, after: battle, events: committed.events } }
          : committed,
      ),
    };
  } else if (transition.command?.type === "finish") {
    next = createDebugBattleModel(input, state.view.scene.owner + 1, state.view.playback.reducedMotion);
    effects.push({ type: "replace-scene", owner: next.view.scene.owner });
  }
  return { state: next, effects, handled: transition.focusExit === "previous" ? false : transition.handled };
}
export function projectDebugBattle(state: DebugBattleModel, input: DebugBattleInput) {
  const ready = state.view.scene.status === "ready";
  const error = state.view.scene.status === "error";
  const view = ready ? projectBattleView(state.view, debugBattleInput(state, input)) : null;
  return {
    view,
    utilityFocus: state.utilityFocus,
    actors: projectBattleActors(state.view.playback),
    animate:
      ready &&
      (state.view.playback.phase !== "finished" || (view?.markerId !== null && !state.view.playback.reducedMotion)),
    status: {
      ready,
      error,
      text: ready
        ? "表示準備完了"
        : error
          ? "戦闘画面を読み込めませんでした。素材の取得とWebGL対応を確認して、再読み込みしてください。"
          : "戦闘画面を読み込んでいます…",
    },
  };
}
