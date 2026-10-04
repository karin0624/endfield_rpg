import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import {
  actInExpedition,
  departOnExpedition,
  type ExpeditionGame,
  type GameActionCompletion,
  leaveExpedition,
} from "../game/expedition";
import { chooseGrowthSkill, hasPendingGrowth } from "../game/growthRuntime";
import { createParty } from "../game/party";
import { deserializeGame, serializeGame } from "../game/save";
import type { CampaignEvent } from "./campaignModel";
import type { GrowthFocus } from "./growthModel";
import { reduceGrowthPresentation } from "./growthModel";
import { createTownState, reduceTown, type TownInput, type TownState } from "./townModel";

export const debugSessionRules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules };
export interface DebugSessionModel {
  readonly game: ExpeditionGame;
  readonly screen: "town" | "growth" | "dungeon" | "saving" | "loading" | "disposed";
  readonly growthFocus: GrowthFocus;
  readonly town: TownState;
  readonly completion?: GameActionCompletion;
  readonly saveStatus: string;
  readonly editorEntry: boolean;
}
export type DebugSessionEvent = CampaignEvent | { readonly type: "return" };
export type DebugSessionEffect =
  | { readonly type: "write-save"; readonly data: string }
  | { readonly type: "read-save" }
  | { readonly type: "replace-town-view" };
export function createDebugSessionModel(entry: "town" | "dungeon", editorEntry = false): DebugSessionModel {
  const initial: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
  };
  const game =
    entry === "dungeon"
      ? departOnExpedition(initial, characters, initialDungeon, initialAdventure, debugSessionRules).state
      : initial;
  return {
    game,
    screen: entry,
    town: { ...createTownState(game.adventure.currentPlaceId), focus: null },
    growthFocus: null,
    saveStatus: "",
    editorEntry,
  };
}
export function debugTownInput(state: DebugSessionModel): TownInput {
  return {
    game: state.game,
    characters,
    definition: initialAdventure,
    rules: debugSessionRules,
    items: [],
    partyEntry: true,
    shopEnabled: false,
    departure: { characters, route: initialDungeon, adventure: initialAdventure, skills: debugSessionRules },
  };
}
export function reduceDebugSession(state: DebugSessionModel, event: DebugSessionEvent) {
  const result = (next = state, effects: readonly DebugSessionEffect[] = [], handled = true) => ({
    state: next,
    effects,
    handled,
    dungeonResult: undefined as ReturnType<typeof actInExpedition>["result"] | undefined,
  });
  const ignored = () => result(state, [], false);
  if (event.type === "disposed") return result({ ...state, screen: "disposed", growthFocus: null });
  if (state.screen === "disposed") return ignored();
  if (event.type === "save-written" && state.screen === "saving")
    return result({
      ...state,
      screen: "town",
      saveStatus: event.saved ? "保存しました。" : "保存できませんでした。ブラウザの保存領域を確認してください。",
    });
  if (event.type === "save-read" && state.screen === "loading") {
    if ("error" in event.result)
      return result({
        ...state,
        screen: "town",
        saveStatus: "読み込めませんでした。ブラウザの保存領域を確認してください。",
      });
    if (event.result.data === null) return result({ ...state, screen: "town", saveStatus: "保存データがありません。" });
    const loaded = deserializeGame(event.result.data, saveDefinitions);
    return loaded.accepted
      ? result(
          {
            ...state,
            game: loaded.state,
            screen: "town",
            town: createTownState(loaded.state.adventure.currentPlaceId),
            completion: undefined,
            saveStatus: "読み込みました。",
          },
          [{ type: "replace-town-view" }],
        )
      : result({
          ...state,
          screen: "town",
          saveStatus:
            loaded.reason === "unsupported-version"
              ? "対応していない保存データです。"
              : "保存データを読み込めませんでした。",
        });
  }
  if (event.type === "town" && state.screen === "town") {
    if (
      (event.event.type === "save" || event.event.type === "load") &&
      state.game.adventure.mode === "town" &&
      (!state.town.party || state.town.party.panel.kind === "closed")
    ) {
      if (event.event.type === "load") return result({ ...state, screen: "loading" }, [{ type: "read-save" }]);
      const saved = serializeGame(state.game, saveDefinitions);
      return saved.accepted
        ? result({ ...state, screen: "saving" }, [{ type: "write-save", data: saved.data }])
        : result({
            ...state,
            saveStatus: saved.reason === "not-in-town" ? "街に戻ってから保存してください。" : "保存できませんでした。",
          });
    }
    const changed = reduceTown(state.town, event.event, debugTownInput(state));
    const next: DebugSessionModel = {
      ...state,
      game: changed.game,
      town: changed.state,
      completion: changed.action?.accepted ? changed.completion : state.completion,
      screen: changed.dungeon ? "dungeon" : hasPendingGrowth(changed.game) ? "growth" : "town",
      growthFocus: hasPendingGrowth(changed.game) ? { kind: "heading" } : null,
    };
    return result(next, [], changed.handled);
  }
  if (event.type === "growth" && (state.screen === "growth" || state.screen === "dungeon")) {
    if (event.event.type !== "choose") {
      const moved = reduceGrowthPresentation(state.growthFocus, event.event, state.game.growth?.choice ?? null);
      return moved.handled ? result({ ...state, growthFocus: moved.focus }) : ignored();
    }
    const changed = chooseGrowthSkill(state.game, event.event.skillId, debugSessionRules);
    if (!changed.accepted) return ignored();
    return result({
      ...state,
      game: changed.state,
      screen: state.screen === "dungeon" ? "dungeon" : hasPendingGrowth(changed.state) ? "growth" : "town",
      growthFocus: hasPendingGrowth(changed.state) ? { kind: "heading" } : null,
      town: hasPendingGrowth(changed.state) ? state.town : createTownState(changed.state.adventure.currentPlaceId),
    });
  }
  if (event.type === "dungeon" && state.screen === "dungeon") {
    const changed = actInExpedition(state.game, event.command, initialDungeon, initialAdventure, debugSessionRules);
    return {
      ...result({ ...state, game: changed.state, completion: changed.completion ?? state.completion }),
      dungeonResult: changed.result,
    };
  }
  if (event.type === "return" && state.screen === "dungeon") {
    const returned = state.game.dungeon
      ? leaveExpedition(state.game, debugSessionRules)
      : { accepted: true, state: state.game, completion: state.completion };
    return returned.accepted
      ? result({
          ...state,
          game: returned.state,
          screen: "town",
          town: createTownState(returned.state.adventure.currentPlaceId),
          completion: returned.completion,
          saveStatus: "",
        })
      : ignored();
  }
  return ignored();
}
