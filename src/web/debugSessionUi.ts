import { characters } from "../content/characters";
import { characterById, getPartyCombatants } from "../game/party";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import {
  createDebugSessionModel,
  type DebugSessionEvent,
  debugSessionRules,
  reduceDebugSession,
} from "../presentation/debugSessionModel";
import { projectDebugSession } from "../presentation/debugSessionProjection";
import { calendarLabel } from "../presentation/statusText";
import { createCampaignView } from "./campaignView";
import { mountDungeonUi } from "./dungeonUi";
import { DEBUG_SAVE_KEY, readSlotData, writeSlotData } from "./saveSlot";

export function mountDebugSession(root: HTMLDivElement, entry: "town" | "dungeon", editorEntry: boolean) {
  let state = createDebugSessionModel(entry, editorEntry);
  const view = createCampaignView(root, dispatch);
  let disposeDungeon: (() => void) | undefined;
  function render() {
    const frame = projectDebugSession(state);
    if (frame.kind !== "dungeon") {
      disposeDungeon?.();
      disposeDungeon = undefined;
    }
    view.render(frame);
    // This legacy resource/sequence view is migrated in the next presentation phase.
    if (frame.kind === "dungeon" && !disposeDungeon && state.game.dungeon) {
      document.body.classList.add("dungeon-mode");
      disposeDungeon = mountDungeonUi(root, {
        allowBasicAttack: true,
        initialState: state.game.dungeon,
        getGrowth: () => state.game.growth,
        chooseGrowth(skillId) {
          dispatch({ type: "growth", event: { type: "choose", skillId } });
          return state.game.dungeon ?? undefined;
        },
        skillRules: debugSessionRules,
        calendarLabel: calendarLabel(state.game.clock),
        combatants: getPartyCombatants(state.game.party, characters).map((member) => ({
          ...member,
          hp: effectiveMaxHp(characterById(characters, member.id).maxHp, member.status ?? healthyStatus()),
        })),
        displayNames: Object.fromEntries(characters.map(({ id, name }) => [id, name])),
        dispatch(command) {
          const changed = reduceDebugSession(state, { type: "dungeon", command });
          state = changed.state;
          if (!changed.dungeonResult) throw new Error("探索の現在状態で操作が成立しません");
          return changed.dungeonResult;
        },
        onReturn() {
          dispatch({ type: "return" });
        },
      });
    }
  }
  function dispatch(event: DebugSessionEvent) {
    const previous = state;
    const changed = reduceDebugSession(state, event);
    state = changed.state;
    for (const effect of changed.effects) if (effect.type === "replace-town-view") view.dispose();
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
    state = reduceDebugSession(state, { type: "disposed" }).state;
    disposeDungeon?.();
    view.dispose();
  };
}
