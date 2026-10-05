import { initialAdventure } from "../content/initialAdventure";
import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "../game/createInitialGameState";
import {
  type AdventureEvent,
  createAdventureEditorPreview,
  createAdventureModel,
  reduceAdventure,
} from "../presentation/adventureModel";
import { projectAdventure } from "../presentation/adventureProjection";
import { type AdventureSettings, parseAdventureSettings } from "../presentation/adventureSettings";
import savedAdventureSettings from "./adventure-settings.json";
import { createAdventureView } from "./adventureView";

/** A standalone conversation preview uses the conversation core, without session time, XP, or recovery. */
export function mountAdventureUi(
  root: HTMLDivElement,
  initialSettings = parseAdventureSettings(savedAdventureSettings),
  editorPreview = false,
) {
  const initialGame = createInitialGameState(initialGameOptions);
  let state = editorPreview
    ? createAdventureEditorPreview(initialGame, initialAdventure)
    : createAdventureModel(initialGame);
  const view = createAdventureView(
    root,
    { party: false, home: false, debug: false, editor: false },
    dispatch,
    initialSettings,
  );
  function render() {
    view.render(
      projectAdventure({
        state: state.game,
        definition: initialAdventure,
        calendar: "OUTPOST / TOWN",
        feedback: [],
        prompt: "行き先を選ぶ",
        focus: state.focus,
        editorPreview,
      }),
    );
  }
  function dispatch(event: AdventureEvent) {
    const previous = state;
    const changed = reduceAdventure(state, event, initialAdventure);
    state = changed.state;
    if (state !== previous) render();
    return changed.handled;
  }
  render();
  return {
    applySettings(settings: AdventureSettings) {
      view.applySettings(settings);
    },
    dispose() {
      state = reduceAdventure(state, { type: "disposed" }, initialAdventure).state;
      view.dispose();
    },
  };
}
