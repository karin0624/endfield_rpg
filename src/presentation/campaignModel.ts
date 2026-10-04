import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { recoveryItemId } from "../content/itemSettings";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import type { EquipmentSlot } from "../game/equipment";
import { editHomeEquipment } from "../game/equipmentRuntime";
import {
  actInExpedition,
  type DungeonCommand,
  type ExpeditionGame,
  type GameActionCompletion,
  leaveExpedition,
  type TownActionResult,
} from "../game/expedition";
import { chooseGrowthSkill, grownCharacters, hasPendingGrowth } from "../game/growthRuntime";
import { createInventory } from "../game/inventory";
import { createParty } from "../game/party";
import { deserializeGame, serializeGame } from "../game/save";
import { type GrowthEvent, reduceGrowthPresentation } from "./growthModel";
import { createPartyModel, type PartyEvent, type PartyInput, type PartyModel, reduceParty } from "./partyModel";
import { calendarLabel } from "./statusText";
import { createTownState, reduceTown, type TownEvent, type TownInput, type TownState } from "./townModel";

// Display names omit development labels; stable IDs and effects are unchanged.
export const campaignRules = {
  catalog: {
    ...skillCatalog,
    skills: skillCatalog.skills.map((skill) => ({ ...skill, name: skill.name.replace(/^検証用/, "") })),
  },
  fatigue: mentalFatigueDefinition,
  growth: growthRules,
};

export function createCampaignGame(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
    inventory: createInventory(),
  };
}
type Confirmation = "new-game" | "save" | "save-title" | "title";
export type CampaignScreen =
  | { readonly kind: "title" | "intro" | "home" | "destinations" | "equipment" | "town" | "dungeon" | "disposed" }
  | { readonly kind: "confirm"; readonly action: Confirmation }
  | { readonly kind: "saving"; readonly returnToTitle: boolean }
  | { readonly kind: "loading" }
  | { readonly kind: "party"; readonly party: Omit<PartyModel, "input">; readonly context: "edit" | "departure" }
  | { readonly kind: "growth"; readonly returnTo: "town" | "dungeon" };
export type CampaignFocus =
  | { readonly kind: "heading" }
  | { readonly kind: "command"; readonly command: string }
  | { readonly kind: "carry" }
  | { readonly kind: "equipment"; readonly characterId: string; readonly slot: EquipmentSlot }
  | { readonly kind: "town-place"; readonly placeId: string }
  | { readonly kind: "growth-heading" }
  | { readonly kind: "growth-candidate"; readonly skillId: string };
export interface CampaignModel {
  readonly game: ExpeditionGame;
  readonly screen: CampaignScreen;
  readonly carryQuantity: number | null;
  readonly completion?: GameActionCompletion;
  readonly message: string;
  readonly focus: CampaignFocus | null;
  readonly town: TownState;
}
export type CampaignCommand =
  | "new-game"
  | "load"
  | "home"
  | "destinations"
  | "town"
  | "edit-party"
  | "prepare-departure"
  | "equipment"
  | "save"
  | "save-title"
  | "title"
  | "accept"
  | "cancel";
export type CampaignTownCommand =
  | { readonly type: "select"; readonly placeId: string }
  | { readonly type: "advance" }
  | { readonly type: "choose"; readonly optionId: string };
export type CampaignEvent =
  | { readonly type: "command"; readonly command: CampaignCommand }
  | { readonly type: "escape" }
  | { readonly type: "focused"; readonly target: CampaignFocus }
  | { readonly type: "carry-changed"; readonly quantity: number | null }
  | {
      readonly type: "equip";
      readonly characterId: string;
      readonly slot: EquipmentSlot;
      readonly instanceId: string | null;
    }
  | { readonly type: "party"; readonly event: PartyEvent }
  | { readonly type: "save-written"; readonly saved: boolean }
  | { readonly type: "save-read"; readonly result: { readonly data: string | null } | { readonly error: true } }
  | { readonly type: "town"; readonly event: TownEvent }
  | { readonly type: "growth"; readonly event: GrowthEvent }
  | { readonly type: "dungeon"; readonly command: DungeonCommand }
  | { readonly type: "return-home" }
  | { readonly type: "disposed" };
export type CampaignEffect =
  | { readonly type: "write-save"; readonly data: string }
  | { readonly type: "read-save" }
  | { readonly type: "report-carry-validity" };
export interface CampaignTransition {
  readonly state: CampaignModel;
  readonly effects: readonly CampaignEffect[];
  readonly handled: boolean;
  readonly townResult?: TownActionResult;
  readonly dungeonResult?: ReturnType<typeof actInExpedition>["result"];
}
export function createCampaignModel(): CampaignModel {
  return {
    game: createCampaignGame(),
    screen: { kind: "title" },
    carryQuantity: 0,
    message: "",
    focus: { kind: "heading" },
    town: createTownState(initialGameOptions.startingPlaceId),
  };
}
export function campaignCarryValid(state: CampaignModel): boolean {
  const stock = state.game.inventory?.items.home.find(({ itemId }) => itemId === recoveryItemId)?.quantity ?? 0;
  return (
    state.carryQuantity !== null &&
    Number.isSafeInteger(state.carryQuantity) &&
    state.carryQuantity >= 0 &&
    state.carryQuantity <= stock
  );
}
function itemSelection(state: CampaignModel) {
  return state.carryQuantity !== null && state.carryQuantity > 0
    ? [{ itemId: recoveryItemId, quantity: state.carryQuantity }]
    : [];
}
function enter(
  state: CampaignModel,
  screen: CampaignScreen,
  message = "",
  focus: CampaignFocus | null = { kind: "heading" },
): CampaignModel {
  return { ...state, screen, message, focus };
}
function townScreen(state: CampaignModel): CampaignModel {
  return hasPendingGrowth(state.game)
    ? enter(state, { kind: "growth", returnTo: "town" }, "", { kind: "growth-heading" })
    : enter({ ...state, town: createTownState(state.game.adventure.currentPlaceId) }, { kind: "town" }, "", {
        kind: "town-place",
        placeId: state.game.adventure.currentPlaceId,
      });
}
export function campaignTownInput(state: CampaignModel): TownInput {
  return {
    game: state.game,
    characters,
    definition: initialAdventure,
    rules: campaignRules,
    items: itemSelection(state),
    partyEntry: false,
    shopEnabled: true,
  };
}
function partyInput(state: CampaignModel, context: "edit" | "departure"): PartyInput {
  const displayCharacters = grownCharacters(state.game, campaignRules);
  return {
    game: state.game,
    characters: displayCharacters,
    calendarLabel: calendarLabel(state.game.clock),
    detailsContext: {
      characters: displayCharacters,
      baseCharacters: characters,
      growth: state.game.growth,
      rules: campaignRules,
    },
    departure:
      context === "departure"
        ? {
            characters,
            route: initialDungeon,
            adventure: initialAdventure,
            skills: campaignRules,
            items: itemSelection(state),
          }
        : undefined,
  };
}
function partyScreen(state: CampaignModel, context: "edit" | "departure"): CampaignModel {
  const { input: _input, ...party } = createPartyModel(
    partyInput(state, context),
    context === "departure" ? "destinations" : "home",
  );
  return enter(state, { kind: "party", party, context }, "", null);
}
/** Campaign owns the game; the child retains only its uncommitted screen state. */
export function campaignPartyModel(
  state: CampaignModel,
  screen: Extract<CampaignScreen, { kind: "party" }>,
): PartyModel {
  return { ...screen.party, input: partyInput(state, screen.context) };
}
export function reduceCampaign(state: CampaignModel, event: CampaignEvent): CampaignTransition {
  const result = (next = state, effects: readonly CampaignEffect[] = [], handled = true): CampaignTransition => ({
    state: next,
    effects,
    handled,
  });
  const ignored = () => result(state, [], false);
  if (event.type === "disposed") return result(enter(state, { kind: "disposed" }, "", null));
  if (state.screen.kind === "disposed") return ignored();
  if (event.type === "focused") return result({ ...state, focus: event.target });
  if (event.type === "save-written" && state.screen.kind === "saving") {
    const message = event.saved ? "保存しました。" : "保存できませんでした。ブラウザの保存領域を確認してください。";
    return result(
      enter(
        event.saved && state.screen.returnToTitle ? { ...state, completion: undefined } : state,
        { kind: event.saved && state.screen.returnToTitle ? "title" : "home" },
        message,
      ),
    );
  }
  if (event.type === "save-read" && state.screen.kind === "loading") {
    if ("error" in event.result)
      return result(enter(state, { kind: "title" }, "読み込めませんでした。ブラウザの保存領域を確認してください。"));
    if (event.result.data === null) return result(enter(state, { kind: "title" }, "保存データがありません。"));
    const loaded = deserializeGame(event.result.data, saveDefinitions);
    return result(
      loaded.accepted
        ? enter(
            { ...state, game: loaded.state, carryQuantity: 0, completion: undefined },
            { kind: "home" },
            "読み込みました。",
          )
        : enter(
            state,
            { kind: "title" },
            loaded.reason === "unsupported-version"
              ? "対応していない保存データです。"
              : "保存データを読み込めませんでした。",
          ),
    );
  }
  if (event.type === "carry-changed" && state.screen.kind === "home")
    return result({ ...state, carryQuantity: event.quantity });
  if (event.type === "equip" && state.screen.kind === "equipment") {
    const changed = editHomeEquipment(
      state.game,
      "home",
      event.characterId,
      event.slot,
      event.instanceId,
      characters,
      campaignRules,
    );
    return result(
      enter(
        { ...state, game: changed.state },
        { kind: "equipment" },
        changed.accepted ? "装備を変更しました。" : "装備を変更できませんでした。",
      ),
    );
  }
  if (event.type === "party" && state.screen.kind === "party") {
    const changed = reduceParty({ ...state.screen.party, input: partyInput(state, state.screen.context) }, event.event);
    const { input, ...party } = changed.state;
    let next: CampaignModel = {
      ...state,
      game: input.game,
      screen: { ...state.screen, party },
    };
    for (const effect of changed.effects) {
      if (effect.type !== "navigate") continue;
      next =
        effect.destination === "dungeon"
          ? enter({ ...next, carryQuantity: 0, completion: undefined }, { kind: "dungeon" }, "", null)
          : enter(next, { kind: effect.destination === "destinations" ? "destinations" : "home" }, "", {
              kind: "command",
              command: effect.destination === "destinations" ? "prepare-departure" : "edit-party",
            });
    }
    return result(next, [], changed.handled);
  }
  if (event.type === "town" && state.screen.kind === "town") {
    const changed = reduceTown(state.town, event.event, campaignTownInput(state));
    const next: CampaignModel = {
      ...state,
      town: changed.state,
      game: changed.game,
      carryQuantity: changed.action?.accepted && event.event.type === "select" ? 0 : state.carryQuantity,
      completion: changed.action?.accepted ? changed.completion : state.completion,
      focus:
        changed.state.focus?.kind === "place" ? { kind: "town-place", placeId: changed.state.focus.placeId } : null,
    };
    return {
      ...result(
        changed.home
          ? enter(next, { kind: "home" })
          : changed.action?.accepted && hasPendingGrowth(next.game)
            ? townScreen(next)
            : next,
        [],
        changed.handled,
      ),
      townResult: changed.action,
    };
  }
  if (event.type === "growth" && (state.screen.kind === "growth" || state.screen.kind === "dungeon")) {
    const choice = state.game.growth?.choice;
    if (!choice || !state.game.growth) return ignored();
    if (event.event.type !== "choose") {
      const moved = reduceGrowthPresentation(
        state.focus?.kind === "growth-heading"
          ? { kind: "heading" }
          : state.focus?.kind === "growth-candidate"
            ? { kind: "candidate", skillId: state.focus.skillId }
            : null,
        event.event,
        choice,
      );
      return moved.handled
        ? result({
            ...state,
            focus:
              moved.focus?.kind === "heading"
                ? { kind: "growth-heading" }
                : moved.focus?.kind === "candidate"
                  ? { kind: "growth-candidate", skillId: moved.focus.skillId }
                  : null,
          })
        : ignored();
    }
    const changed = chooseGrowthSkill(state.game, event.event.skillId, campaignRules);
    if (!changed.accepted) return ignored();
    const next = { ...state, game: changed.state };
    // The legacy dungeon view is replaced in the battle/route presentation phase of this refactor.
    if (state.screen.kind === "growth")
      return result(
        state.screen.returnTo === "town"
          ? townScreen(next)
          : enter(
              next,
              hasPendingGrowth(next.game) ? state.screen : { kind: "dungeon" },
              "",
              hasPendingGrowth(next.game) ? { kind: "growth-heading" } : null,
            ),
      );
    return result(next, [], changed.accepted);
  }
  if (event.type === "dungeon" && state.screen.kind === "dungeon") {
    const changed = actInExpedition(state.game, event.command, initialDungeon, initialAdventure, campaignRules);
    // The resolved result is rendered before the exit screen: defeat/return presentation owns this boundary.
    return {
      ...result({ ...state, game: changed.state, completion: changed.completion ?? state.completion }),
      dungeonResult: changed.result,
    };
  }
  if (event.type === "return-home" && state.screen.kind === "dungeon") {
    if (state.game.dungeon === null) return result(enter(state, { kind: "home" }));
    const returned = leaveExpedition(state.game, campaignRules);
    return returned.accepted
      ? result(enter({ ...state, game: returned.state, completion: returned.completion }, { kind: "home" }))
      : ignored();
  }
  if (event.type === "escape") {
    if (state.screen.kind === "confirm") return reduceCampaign(state, { type: "command", command: "cancel" });
    if (state.screen.kind === "destinations") return result(enter(state, { kind: "home" }));
    return ignored();
  }
  if (event.type !== "command") return ignored();
  const command = event.command;
  switch (state.screen.kind) {
    case "title":
      if (command === "new-game")
        return result(
          enter(state, { kind: "confirm", action: "new-game" }, "", { kind: "command", command: "cancel" }),
        );
      if (command === "load") return result(enter(state, { kind: "loading" }), [{ type: "read-save" }]);
      break;
    case "intro":
      if (command === "home") return result(enter(state, { kind: "home" }));
      if (command === "title") return result(enter(state, { kind: "title" }));
      break;
    case "confirm":
      if (command === "cancel")
        return result(enter(state, { kind: state.screen.action === "new-game" ? "title" : "home" }));
      if (command !== "accept") break;
      if (state.screen.action === "new-game") return result(enter(createCampaignModel(), { kind: "intro" }));
      if (state.screen.action === "title") return result(enter({ ...state, completion: undefined }, { kind: "title" }));
      {
        const saved = serializeGame(state.game, saveDefinitions);
        return saved.accepted
          ? result(enter(state, { kind: "saving", returnToTitle: state.screen.action === "save-title" }), [
              { type: "write-save", data: saved.data },
            ])
          : result(
              enter(
                state,
                { kind: "home" },
                saved.reason === "not-in-town" ? "街に戻ってから保存してください。" : "保存できませんでした。",
              ),
            );
      }
    case "home":
      if (command === "destinations")
        return campaignCarryValid(state)
          ? result(enter(state, { kind: "destinations" }))
          : result(state, [{ type: "report-carry-validity" }]);
      if (command === "equipment") return result(enter(state, { kind: "equipment" }));
      if (command === "edit-party") return result(partyScreen(state, "edit"));
      if (command === "save" || command === "save-title" || command === "title")
        return result(enter(state, { kind: "confirm", action: command }, "", { kind: "command", command: "cancel" }));
      break;
    case "equipment":
      if (command === "home") return result(enter(state, { kind: "home" }));
      break;
    case "destinations":
      if (command === "home") return result(enter(state, { kind: "home" }));
      if (command === "town") return result(townScreen(state));
      if (command === "prepare-departure") return result(partyScreen(state, "departure"));
      break;
    case "town":
      if (command === "home" && state.game.adventure.mode === "town") return result(enter(state, { kind: "home" }));
      break;
  }
  return ignored();
}
