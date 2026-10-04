import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import type { DungeonActionResult } from "../game/dungeon";
import {
  departOnExpedition,
  type ExpeditionGame,
  type GameActionCompletion,
  leaveExpedition,
} from "../game/expedition";
import { chooseGrowthSkill, hasPendingGrowth } from "../game/growthRuntime";
import { createParty } from "../game/party";
import { deserializeGame, serializeGame } from "../game/save";
import type { BattleInput } from "./battleModel";
import type { CampaignEvent } from "./campaignModel";
import {
  createDungeonModel,
  type DungeonEffect,
  type DungeonInput,
  type DungeonModel,
  reduceDungeon,
} from "./dungeonModel";
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
  readonly expedition: DungeonModel | null;
}
export type DebugSessionEvent = CampaignEvent;
export type DebugSessionEffect =
  | { readonly type: "write-save"; readonly data: string }
  | { readonly type: "read-save" }
  | { readonly type: "replace-town-view" }
  | { readonly type: "dungeon"; readonly effect: DungeonEffect };
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
    expedition:
      entry === "dungeon"
        ? createDungeonModel({
            game,
            route: initialDungeon,
            adventure: initialAdventure,
            rules: debugSessionRules,
            basicAttack: true,
            items: false,
            enemyDepths: [],
          })
        : null,
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
export function debugDungeonInput(
  state: DebugSessionModel,
  enemyDepths: BattleInput["enemyDepths"] = [],
): DungeonInput {
  return {
    game: state.game,
    route: initialDungeon,
    adventure: initialAdventure,
    rules: debugSessionRules,
    basicAttack: true,
    items: false,
    enemyDepths,
  };
}
export function reduceDebugSession(
  state: DebugSessionModel,
  event: DebugSessionEvent,
  enemyDepths: BattleInput["enemyDepths"] = [],
) {
  const result = (next = state, effects: readonly DebugSessionEffect[] = [], handled = true) => ({
    state: next,
    effects,
    handled,
    dungeonResult: undefined as DungeonActionResult | undefined,
  });
  const ignored = () => result(state, [], false);
  if (event.type === "disposed") {
    const closed = state.expedition
      ? reduceDungeon(state.expedition, debugDungeonInput(state, enemyDepths), { type: "closed" })
      : null;
    return result(
      { ...state, screen: "disposed", growthFocus: null, expedition: null },
      closed?.effects.map((effect) => ({ type: "dungeon", effect })) ?? [],
    );
  }
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
      expedition: changed.dungeon
        ? createDungeonModel(debugDungeonInput({ ...state, game: changed.game }))
        : state.expedition,
    };
    return result(next, [], changed.handled);
  }
  if (event.type === "growth" && state.screen === "growth") {
    if (event.event.type !== "choose") {
      const moved = reduceGrowthPresentation(state.growthFocus, event.event, state.game.growth?.choice ?? null);
      return moved.handled ? result({ ...state, growthFocus: moved.focus }) : ignored();
    }
    const changed = chooseGrowthSkill(state.game, event.event.skillId, debugSessionRules);
    if (!changed.accepted) return ignored();
    return result({
      ...state,
      game: changed.state,
      screen: hasPendingGrowth(changed.state) ? "growth" : "town",
      growthFocus: hasPendingGrowth(changed.state) ? { kind: "heading" } : null,
      town: hasPendingGrowth(changed.state) ? state.town : createTownState(changed.state.adventure.currentPlaceId),
    });
  }
  if (event.type === "dungeon" && state.screen === "dungeon" && state.expedition) {
    const input = debugDungeonInput(state, enemyDepths);
    const changed = reduceDungeon(state.expedition, input, event.event);
    let next =
      changed.state === state.expedition && changed.game === state.game
        ? state
        : {
            ...state,
            game: changed.game,
            expedition: changed.state,
            completion: changed.completion ?? state.completion,
          };
    let effects = changed.effects;
    if (changed.returnRequested) {
      const returned = changed.game.dungeon
        ? leaveExpedition(changed.game, debugSessionRules)
        : { accepted: true, state: changed.game, completion: changed.completion ?? state.completion };
      if (returned.accepted) {
        const closed = reduceDungeon(changed.state, { ...input, game: returned.state }, { type: "closed" });
        next = {
          ...next,
          game: returned.state,
          expedition: null,
          screen: "town",
          town: createTownState(returned.state.adventure.currentPlaceId),
          completion: returned.completion,
          saveStatus: "",
        };
        effects = [...effects, ...closed.effects];
      }
    }
    return {
      ...result(
        next,
        effects.map((effect) => ({ type: "dungeon", effect })),
        changed.handled,
      ),
      dungeonResult: changed.result,
    };
  }
  return ignored();
}
