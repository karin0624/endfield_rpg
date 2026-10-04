import { characters } from "../content/characters";
import { characterById, getPartyCombatants } from "../game/party";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import { type CampaignEvent, campaignRules, createCampaignModel, reduceCampaign } from "../presentation/campaignModel";
import { projectCampaign } from "../presentation/campaignProjection";
import { calendarLabel } from "../presentation/statusText";
import { createCampaignView } from "./campaignView";
import { mountDungeonUi } from "./dungeonUi";
import { readSlotData, writeSlotData } from "./saveSlot";

/** Native inputs and external I/O results are synchronously delivered to the current application state. */
export function mountCampaign(root: HTMLDivElement): () => void {
  let state = createCampaignModel();
  const view = createCampaignView(root, dispatch);
  let disposeDungeon: (() => void) | undefined;
  function render() {
    const frame = projectCampaign(state);
    if (frame.kind !== "dungeon") {
      disposeDungeon?.();
      disposeDungeon = undefined;
    }
    view.render(frame);
    // This existing renderer/sequence adapter is migrated next, rather than declared an E2E exception.
    if (frame.kind === "dungeon" && !disposeDungeon && state.game.dungeon) {
      document.body.classList.add("dungeon-mode");
      disposeDungeon = mountDungeonUi(root, {
        initialState: state.game.dungeon,
        getItems: () => state.game.inventory?.items,
        getGrowth: () => state.game.growth,
        chooseGrowth(skillId) {
          dispatch({ type: "growth", event: { type: "choose", skillId } });
          return state.game.dungeon ?? undefined;
        },
        skillRules: campaignRules,
        calendarLabel: calendarLabel(state.game.clock),
        combatants: getPartyCombatants(state.game.party, characters).map((member) => ({
          ...member,
          hp: effectiveMaxHp(characterById(characters, member.id).maxHp, member.status ?? healthyStatus()),
        })),
        displayNames: Object.fromEntries(characters.map(({ id, name }) => [id, name])),
        dispatch(command) {
          const changed = reduceCampaign(state, { type: "dungeon", command });
          state = changed.state;
          if (!changed.dungeonResult) throw new Error("探索の現在状態で操作が成立しません");
          return changed.dungeonResult;
        },
        returnLabel: "ホームへ帰還",
        onReturn() {
          dispatch({ type: "return-home" });
        },
      });
    }
  }
  function dispatch(event: CampaignEvent): boolean {
    const previous = state;
    const changed = reduceCampaign(state, event);
    state = changed.state;
    if (state !== previous) render();
    for (const effect of changed.effects) {
      if (effect.type === "write-save") dispatch({ type: "save-written", saved: writeSlotData(effect.data) });
      else if (effect.type === "read-save") dispatch({ type: "save-read", result: readSlotData() });
      else view.reportCarryValidity();
    }
    return changed.handled;
  }
  render();
  return () => {
    state = reduceCampaign(state, { type: "disposed" }).state;
    disposeDungeon?.();
    disposeDungeon = undefined;
    view.dispose();
  };
}
