import { projectBattleActors } from "../presentation/battleProjection";
import {
  createDebugSessionModel,
  type DebugSessionEvent,
  debugDungeonInput,
  reduceDebugSession,
} from "../presentation/debugSessionModel";
import { projectDebugSession } from "../presentation/debugSessionProjection";
import { createCampaignView } from "./campaignView.svelte.ts";
import { createDungeonView } from "./dungeonView.svelte.ts";
import { DEBUG_SAVE_KEY, readSlotData, writeSlotData } from "./saveSlot";

export function mountDebugSession(root: HTMLDivElement, entry: "town" | "dungeon", editorEntry: boolean) {
  let state = createDebugSessionModel(entry, editorEntry);
  let view: ReturnType<typeof createCampaignView> | undefined;
  let dungeon: ReturnType<typeof createDungeonView> | undefined;
  function prepareDungeon() {
    if (state.screen !== "dungeon" || !state.expedition || dungeon) return;
    view?.dispose();
    view = undefined;
    dungeon = createDungeonView(root, (event) => dispatch({ type: "dungeon", event }), "街へ戻る");
    dispatch({ type: "dungeon", event: { type: "motion", reduced: dungeon.reducedMotion() } });
  }
  function render() {
    if (state.screen === "dungeon" && state.expedition) {
      prepareDungeon();
      if (state.expedition) dungeon?.renderModel(state.expedition, debugDungeonInput(state, dungeon?.getEnemyDepths()));
    } else {
      const previous = dungeon;
      dungeon = undefined;
      previous?.dispose();
      if (state.screen === "disposed") {
        view?.dispose();
        view = undefined;
        return;
      }
      view ??= createCampaignView(root, dispatch);
      view.render(projectDebugSession(state));
    }
  }
  function dispatch(event: DebugSessionEvent) {
    const previous = state;
    const changed = reduceDebugSession(state, event, dungeon?.getEnemyDepths());
    state = changed.state;
    for (const effect of changed.effects) {
      if (effect.type === "replace-town-view") {
        view?.dispose();
        view = undefined;
      } else if (effect.type === "dungeon") {
        if (effect.effect.type === "open-scene") prepareDungeon();
        const battle = state.expedition?.screen.kind === "battle" ? state.expedition.screen.battle : null;
        dungeon?.effect(
          effect.effect,
          battle
            ? { definitions: battle.playback.record.before.combatants, actors: projectBattleActors(battle.playback) }
            : null,
        );
      }
    }
    if (state !== previous) render();
    for (const effect of changed.effects) {
      if (effect.type === "write-save")
        dispatch({ type: "save-written", saved: writeSlotData(effect.data, undefined, DEBUG_SAVE_KEY) });
      else if (effect.type === "read-save")
        dispatch({ type: "save-read", result: readSlotData(undefined, DEBUG_SAVE_KEY) });
    }
    return changed.handled;
  }
  render();
  return () => dispatch({ type: "disposed" });
}
