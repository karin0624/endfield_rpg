import { createDebugSessionModel, type DebugSessionEvent, reduceDebugSession } from "../presentation/debugSessionModel";
import { projectDebugSession } from "../presentation/debugSessionProjection";
import { createCampaignView } from "./campaignView";
import { createDungeonView } from "./dungeonView";
import { DEBUG_SAVE_KEY, readSlotData, writeSlotData } from "./saveSlot";

export function mountDebugSession(root: HTMLDivElement, entry: "town" | "dungeon", editorEntry: boolean) {
  let state = createDebugSessionModel(entry, editorEntry);
  const view = createCampaignView(root, dispatch);
  let dungeon: ReturnType<typeof createDungeonView> | undefined;
  function prepareDungeon() {
    const frame = projectDebugSession(state, dungeon?.getEnemyDepths());
    if (frame.kind === "dungeon" && frame.dungeon && !dungeon) {
      view.render(frame);
      dungeon = createDungeonView(root, (event) => dispatch({ type: "dungeon", event }), frame.dungeon.returnLabel);
      dispatch({ type: "dungeon", event: { type: "motion", reduced: dungeon.reducedMotion() } });
    }
  }
  function render() {
    prepareDungeon();
    const frame = projectDebugSession(state, dungeon?.getEnemyDepths());
    if (frame.kind !== "dungeon") {
      const previous = dungeon;
      dungeon = undefined;
      previous?.dispose();
    }
    view.render(frame);
    if (frame.kind === "dungeon" && frame.dungeon) dungeon?.render(frame.dungeon);
  }
  function dispatch(event: DebugSessionEvent) {
    const previous = state;
    const changed = reduceDebugSession(state, event, dungeon?.getEnemyDepths());
    state = changed.state;
    for (const effect of changed.effects) {
      if (effect.type === "replace-town-view") view.dispose();
      else if (effect.type === "dungeon") {
        if (effect.effect.type === "open-scene") prepareDungeon();
        const frame = projectDebugSession(state, dungeon?.getEnemyDepths());
        dungeon?.effect(effect.effect, frame.kind === "dungeon" ? (frame.dungeon?.battle ?? null) : null);
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
  return () => {
    dispatch({ type: "disposed" });
    view.dispose();
  };
}
