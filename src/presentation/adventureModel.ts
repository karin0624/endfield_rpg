import {
  type AdventureActionResult,
  type AdventureDefinition,
  advanceConversation,
  chooseConversationOption,
  getCurrentConversationScene,
  selectTownPlace,
} from "../game/adventure";
import type { GameState } from "../game/createInitialGameState";
import type { AdventureFocus } from "./adventureProjection";
import type { PartyEvent } from "./partyModel";

export type InputContext = "screen" | "text-entry" | "control";
export type AdventureCommand =
  | { readonly type: "select"; readonly placeId: string }
  | { readonly type: "advance" }
  | { readonly type: "choose"; readonly optionId: string };
export type AdventureEvent =
  | AdventureCommand
  | { readonly type: "key"; readonly code: string }
  | { readonly type: "focused"; readonly target: NonNullable<AdventureFocus> }
  | { readonly type: "input-context"; readonly context: InputContext }
  | { readonly type: "open-party" }
  | { readonly type: "party"; readonly event: PartyEvent }
  | { readonly type: "home" | "save" | "load" | "disposed" };
export interface AdventureModel {
  readonly game: GameState;
  readonly active: boolean;
  readonly focus: AdventureFocus;
  readonly inputContext: InputContext;
}
export function createAdventureModel(game: GameState): AdventureModel {
  return { game, active: true, focus: null, inputContext: "screen" };
}
/** Native editing/activation and conversation commands have different meanings at the current focus. */
export function adventureKeyCommand(
  game: GameState,
  definition: AdventureDefinition,
  context: InputContext,
  code: string,
): AdventureCommand | undefined {
  if (context === "text-entry") return undefined;
  const scene = getCurrentConversationScene(game, definition);
  if (scene?.type === "line" && context !== "control" && code === "Space") return { type: "advance" };
  if (scene?.type === "choice" && /^(Digit|Numpad)[1-9]$/.test(code)) {
    const option = scene.options[Number(code.at(-1)) - 1];
    if (option) return { type: "choose", optionId: option.id };
  }
  return undefined;
}
export function reduceAdventure(
  state: AdventureModel,
  event: AdventureEvent,
  definition: AdventureDefinition,
): { readonly state: AdventureModel; readonly handled: boolean; readonly result?: AdventureActionResult } {
  const ignored = { state, handled: false };
  if (event.type === "disposed")
    return { state: { ...state, active: false, focus: null, inputContext: "screen" }, handled: true };
  if (!state.active) return ignored;
  if (event.type === "input-context")
    return {
      state: { ...state, inputContext: event.context, focus: event.context === "control" ? state.focus : null },
      handled: true,
    };
  if (event.type === "focused")
    return { state: { ...state, focus: event.target, inputContext: "control" }, handled: true };
  if (event.type === "key") {
    const command = adventureKeyCommand(state.game, definition, state.inputContext, event.code);
    return command ? reduceAdventure(state, command, definition) : ignored;
  }
  const result =
    event.type === "select"
      ? selectTownPlace(state.game, event.placeId, definition)
      : event.type === "advance"
        ? advanceConversation(state.game, definition)
        : event.type === "choose"
          ? chooseConversationOption(state.game, event.optionId, definition)
          : undefined;
  if (!result) return ignored;
  return {
    state: result.accepted
      ? {
          ...state,
          game: result.state,
          inputContext: "screen",
          focus: result.state.mode === "town" ? { kind: "place", placeId: result.state.currentPlaceId } : null,
        }
      : state,
    handled: result.accepted,
    result,
  };
}
