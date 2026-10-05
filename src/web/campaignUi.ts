import { projectBattleActors } from "../presentation/battleProjection";
import {
  type CampaignEvent,
  campaignDungeonInput,
  createCampaignModel,
  reduceCampaign,
} from "../presentation/campaignModel";
import { projectCampaign } from "../presentation/campaignProjection";
import { createCampaignView } from "./campaignView.svelte.ts";
import { createDungeonView } from "./dungeonView.svelte.ts";
import { readSlotData, writeSlotData } from "./saveSlot";

/** Commit game/screen state before native work, including callbacks that synchronously reenter. */
export function mountCampaign(root: HTMLDivElement): () => void {
  let state = createCampaignModel();
  let view: ReturnType<typeof createCampaignView> | undefined;
  let dungeon: ReturnType<typeof createDungeonView> | undefined;
  function prepareDungeon() {
    if (state.screen.kind !== "dungeon" || !state.expedition || dungeon) return;
    view?.dispose();
    view = undefined;
    dungeon = createDungeonView(root, (event) => dispatch({ type: "dungeon", event }), "ホームへ帰還");
    dispatch({ type: "dungeon", event: { type: "motion", reduced: dungeon.reducedMotion() } });
  }
  function render() {
    if (state.screen.kind === "dungeon" && state.expedition) {
      prepareDungeon();
      if (state.expedition)
        dungeon?.renderModel(state.expedition, campaignDungeonInput(state, dungeon?.getEnemyDepths()));
    } else {
      const previous = dungeon;
      dungeon = undefined;
      previous?.dispose();
      if (state.screen.kind === "disposed") {
        view?.dispose();
        view = undefined;
        return;
      }
      view ??= createCampaignView(root, dispatch);
      view.render(projectCampaign(state));
    }
  }
  function dispatch(event: CampaignEvent) {
    const previous = state;
    const changed = reduceCampaign(state, event, dungeon?.getEnemyDepths());
    state = changed.state;
    for (const effect of changed.effects) {
      if (effect.type !== "dungeon") continue;
      if (effect.effect.type === "open-scene") prepareDungeon();
      const battle = state.expedition?.screen.kind === "battle" ? state.expedition.screen.battle : null;
      dungeon?.effect(
        effect.effect,
        battle
          ? { definitions: battle.playback.record.before.combatants, actors: projectBattleActors(battle.playback) }
          : null,
      );
    }
    if (state !== previous) render();
    for (const effect of changed.effects) {
      if (effect.type === "write-save") dispatch({ type: "save-written", saved: writeSlotData(effect.data) });
      else if (effect.type === "read-save") dispatch({ type: "save-read", result: readSlotData() });
      else if (effect.type === "report-carry-validity") view?.reportCarryValidity();
    }
    return changed.handled;
  }
  render();
  return () => dispatch({ type: "disposed" });
}
