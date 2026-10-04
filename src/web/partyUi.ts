import type { ExpeditionGame } from "../game/expedition";
import {
  createPartyModel,
  type PartyEvent,
  type PartyInput,
  type PartyReturnScreen,
  reduceParty,
} from "../presentation/partyModel";
import { projectParty } from "../presentation/partyProjection";
import { createPartyView } from "./partyView";

export interface PartyUiOptions {
  readonly getInput: () => PartyInput;
  readonly returnTo: PartyReturnScreen;
  readonly changed: (game: ExpeditionGame) => void;
  readonly navigate: (destination: PartyReturnScreen | "dungeon") => void;
}

/** Transport native events to the application model, and apply its explicit results. */
export function mountPartyUi(root: HTMLElement, options: PartyUiOptions) {
  let state = createPartyModel(options.getInput(), options.returnTo);
  const view = createPartyView(root, dispatch);
  function dispatch(event: PartyEvent) {
    const next = reduceParty(state, event);
    state = next.state;
    view.render(projectParty(state));
    for (const effect of next.effects) {
      if (effect.type === "game-changed") options.changed(effect.game);
      if (effect.type === "navigate") options.navigate(effect.destination);
    }
    return next.handled;
  }
  view.render(projectParty(state));
  return {
    show: () => dispatch({ type: "shown", input: options.getInput() }),
    refresh: () => dispatch({ type: "refreshed", input: options.getInput() }),
    dispose() {
      dispatch({ type: "disposed" });
      view.dispose();
    },
  };
}
