import { type CampaignEvent, createCampaignModel, reduceCampaign } from "../presentation/campaignModel";
import { projectCampaign } from "../presentation/campaignProjection";
import { createCampaignView } from "./campaignView";
import { createDungeonView } from "./dungeonView";
import { readSlotData, writeSlotData } from "./saveSlot";

/** Commit the current application state before starting native resources or external I/O. */
export function mountCampaign(root: HTMLDivElement): () => void {
  let state = createCampaignModel();
  const view = createCampaignView(root, dispatch);
  let dungeon: ReturnType<typeof createDungeonView> | undefined;
  function prepareDungeon() {
    const frame = projectCampaign(state, dungeon?.getEnemyDepths());
    if (frame.kind === "dungeon" && frame.dungeon && !dungeon) {
      view.render(frame);
      dungeon = createDungeonView(root, (event) => dispatch({ type: "dungeon", event }), frame.dungeon.returnLabel);
      dispatch({ type: "dungeon", event: { type: "motion", reduced: dungeon.reducedMotion() } });
    }
  }
  function render() {
    prepareDungeon();
    const frame = projectCampaign(state, dungeon?.getEnemyDepths());
    if (frame.kind !== "dungeon") {
      const previous = dungeon;
      dungeon = undefined;
      previous?.dispose();
    }
    view.render(frame);
    if (frame.kind === "dungeon" && frame.dungeon) dungeon?.render(frame.dungeon);
  }
  function dispatch(event: CampaignEvent) {
    const previous = state;
    const changed = reduceCampaign(state, event, dungeon?.getEnemyDepths());
    state = changed.state;
    for (const effect of changed.effects) {
      if (effect.type !== "dungeon") continue;
      if (effect.effect.type === "open-scene") prepareDungeon();
      const frame = projectCampaign(state, dungeon?.getEnemyDepths());
      dungeon?.effect(effect.effect, frame.kind === "dungeon" ? (frame.dungeon?.battle ?? null) : null);
    }
    if (state !== previous) render();
    for (const effect of changed.effects) {
      if (effect.type === "write-save") dispatch({ type: "save-written", saved: writeSlotData(effect.data) });
      else if (effect.type === "read-save") dispatch({ type: "save-read", result: readSlotData() });
      else if (effect.type === "report-carry-validity") view.reportCarryValidity();
    }
    return changed.handled;
  }
  render();
  return () => {
    dispatch({ type: "disposed" });
    view.dispose();
  };
}
