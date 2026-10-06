import { assign, enqueueActions, initialTransition, type SnapshotFrom, setup, transition } from "xstate";
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
import type { DungeonActionResult } from "../game/dungeon";
import type { EquipmentSlot } from "../game/equipment";
import { editHomeEquipment } from "../game/equipmentRuntime";
import {
  type ExpeditionGame,
  type GameActionCompletion,
  leaveExpedition,
  type TownActionResult,
} from "../game/expedition";
import { chooseGrowthSkill, grownCharacters, hasPendingGrowth } from "../game/growthRuntime";
import { createInventory } from "../game/inventory";
import { createParty } from "../game/party";
import { deserializeGame, serializeGame } from "../game/save";
import type { BattleInput } from "./battleModel";
import {
  createDungeonModel,
  type DungeonEffect,
  type DungeonEvent,
  type DungeonInput,
  type DungeonModel,
  reduceDungeon,
} from "./dungeonModel";
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
export interface CampaignParty {
  readonly party: Omit<PartyModel, "input">;
  readonly context: "edit" | "departure";
}
export type CampaignFocus =
  | { readonly kind: "heading" }
  | { readonly kind: "command"; readonly command: string }
  | { readonly kind: "carry" }
  | { readonly kind: "equipment"; readonly characterId: string; readonly slot: EquipmentSlot }
  | { readonly kind: "town-place"; readonly placeId: string }
  | { readonly kind: "growth-heading" }
  | { readonly kind: "growth-candidate"; readonly skillId: string };
export interface CampaignContext {
  readonly game: ExpeditionGame;
  readonly confirmation: Confirmation;
  readonly returnToTitle: boolean;
  readonly party: CampaignParty | null;
  readonly carryQuantity: number | null;
  readonly completion?: GameActionCompletion;
  readonly message: string;
  readonly focus: CampaignFocus | null;
  readonly town: TownState;
  readonly expedition: DungeonModel | null;
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
  | { readonly type: "dungeon"; readonly event: DungeonEvent }
  | { readonly type: "disposed" };
export type CampaignEffect =
  | { readonly type: "write-save"; readonly data: string }
  | { readonly type: "read-save" }
  | { readonly type: "report-carry-validity" }
  | { readonly type: "dungeon"; readonly effect: DungeonEffect };
interface CampaignOutput {
  readonly effects: readonly CampaignEffect[];
  readonly handled: boolean;
  readonly townResult?: TownActionResult;
  readonly dungeonResult?: DungeonActionResult;
}
export interface CampaignTransition extends CampaignOutput {
  readonly state: CampaignModel;
}
function initialContext(): CampaignContext {
  return {
    game: createCampaignGame(),
    confirmation: "new-game",
    returnToTitle: false,
    party: null,
    carryQuantity: 0,
    message: "",
    focus: { kind: "heading" },
    town: createTownState(initialGameOptions.startingPlaceId),
    expedition: null,
  };
}
function carryValid(state: CampaignContext): boolean {
  const stock = state.game.inventory?.items.home.find(({ itemId }) => itemId === recoveryItemId)?.quantity ?? 0;
  return (
    state.carryQuantity !== null &&
    Number.isSafeInteger(state.carryQuantity) &&
    state.carryQuantity >= 0 &&
    state.carryQuantity <= stock
  );
}
function itemSelection(state: CampaignContext) {
  return state.carryQuantity !== null && state.carryQuantity > 0
    ? [{ itemId: recoveryItemId, quantity: state.carryQuantity }]
    : [];
}
function townInput(state: CampaignContext): TownInput {
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
function dungeonInput(state: CampaignContext, enemyDepths: BattleInput["enemyDepths"] = []): DungeonInput {
  return {
    game: state.game,
    route: initialDungeon,
    adventure: initialAdventure,
    rules: campaignRules,
    basicAttack: false,
    items: true,
    enemyDepths,
  };
}
function partyInput(state: CampaignContext, context: "edit" | "departure"): PartyInput {
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
function prepareParty(state: CampaignContext, context: "edit" | "departure"): CampaignParty {
  const { input: _input, ...party } = createPartyModel(
    partyInput(state, context),
    context === "departure" ? "destinations" : "home",
  );
  return { party, context };
}
const heading = { message: "", focus: { kind: "heading" as const } };
type MachineEvent =
  | Exclude<CampaignEvent, { type: "command" | "dungeon" }>
  | { [C in CampaignCommand]: { readonly type: `command.${C}` } }[CampaignCommand]
  | { readonly type: "dungeon"; readonly event: DungeonEvent; readonly enemyDepths: BattleInput["enemyDepths"] }
  | {
      readonly type:
        | "party-home"
        | "party-destinations"
        | "party-dungeon"
        | "town-home"
        | "town-growth"
        | "growth-done"
        | "expedition-returned";
    };
// Only pure transition() consumes these typed action descriptors; there is no actor implementation.
const flow = setup<
  CampaignContext,
  MachineEvent,
  Record<never, never>,
  Record<never, never>,
  { output: CampaignOutput }
>({});
const enterHeading = flow.assign(heading);
const enterTown = flow.assign(({ context }) => ({
  ...heading,
  town: createTownState(context.game.adventure.currentPlaceId),
  focus: { kind: "town-place" as const, placeId: context.game.adventure.currentPlaceId },
}));
const enterGrowth = flow.assign({ ...heading, focus: { kind: "growth-heading" } });
const cancel = [
  {
    guard: ({ context }: { context: CampaignContext }) => context.confirmation === "new-game",
    target: "title",
    actions: enterHeading,
  },
  { target: "home", actions: enterHeading },
];
export const campaignMachine = flow.createMachine({
  id: "campaign",
  initial: "title",
  context: initialContext,
  on: {
    focused: { actions: assign(({ event }) => ({ focus: event.target })) },
    disposed: {
      target: ".disposed",
      actions: enqueueActions(({ context, enqueue }) => {
        const closed = context.expedition
          ? reduceDungeon(context.expedition, dungeonInput(context), { type: "closed" })
          : null;
        enqueue.assign({ ...heading, expedition: null, focus: null });
        enqueue({
          type: "output",
          params: { handled: true, effects: closed?.effects.map((effect) => ({ type: "dungeon", effect })) ?? [] },
        });
      }),
    },
  },
  states: {
    title: {
      on: {
        "town-home": "home",
        "command.new-game": {
          target: "confirm",
          actions: assign({ ...heading, confirmation: "new-game", focus: { kind: "command", command: "cancel" } }),
        },
        "command.load": {
          target: "loading",
          actions: [enterHeading, { type: "output", params: { handled: true, effects: [{ type: "read-save" }] } }],
        },
      },
    },
    intro: {
      on: {
        "command.home": { target: "home", actions: enterHeading },
        "command.title": { target: "title", actions: enterHeading },
      },
    },
    confirm: {
      on: {
        "command.cancel": cancel,
        escape: cancel,
        "command.accept": [
          {
            guard: ({ context }) => context.confirmation === "new-game",
            target: "intro",
            actions: assign(initialContext),
          },
          {
            guard: ({ context }) => context.confirmation === "title",
            target: "title",
            actions: assign({ ...heading, completion: undefined }),
          },
          {
            target: "saving",
            actions: enqueueActions(({ context, enqueue }) => {
              const saved = serializeGame(context.game, saveDefinitions);
              if (saved.accepted) {
                enqueue.assign({ ...heading, returnToTitle: context.confirmation === "save-title" });
                enqueue({
                  type: "output",
                  params: { handled: true, effects: [{ type: "write-save", data: saved.data }] },
                });
              } else {
                enqueue.assign({
                  ...heading,
                  message:
                    saved.reason === "not-in-town" ? "街に戻ってから保存してください。" : "保存できませんでした。",
                });
                enqueue.raise({ type: "town-home" });
              }
            }),
          },
        ],
      },
    },
    saving: {
      on: {
        "town-home": "home",
        "save-written": [
          {
            guard: ({ context, event }) => event.saved && context.returnToTitle,
            target: "title",
            actions: assign({ ...heading, completion: undefined, message: "保存しました。" }),
          },
          {
            target: "home",
            actions: assign(({ event }) => ({
              ...heading,
              message: event.saved ? "保存しました。" : "保存できませんでした。ブラウザの保存領域を確認してください。",
            })),
          },
        ],
      },
    },
    loading: {
      on: {
        "save-read": {
          target: "title",
          actions: enqueueActions(({ event, enqueue }) => {
            if ("error" in event.result) {
              enqueue.assign({ ...heading, message: "読み込めませんでした。ブラウザの保存領域を確認してください。" });
              return;
            }
            if (event.result.data === null) {
              enqueue.assign({ ...heading, message: "保存データがありません。" });
              return;
            }
            const loaded = deserializeGame(event.result.data, saveDefinitions);
            if (loaded.accepted) {
              enqueue.assign({
                ...heading,
                game: loaded.state,
                carryQuantity: 0,
                completion: undefined,
                message: "読み込みました。",
              });
              enqueue.raise({ type: "town-home" });
            } else
              enqueue.assign({
                ...heading,
                message:
                  loaded.reason === "unsupported-version"
                    ? "対応していない保存データです。"
                    : "保存データを読み込めませんでした。",
              });
          }),
        },
      },
    },
    home: {
      on: {
        "carry-changed": { actions: assign(({ event }) => ({ carryQuantity: event.quantity })) },
        "command.destinations": [
          { guard: ({ context }) => carryValid(context), target: "destinations", actions: enterHeading },
          { actions: { type: "output", params: { handled: true, effects: [{ type: "report-carry-validity" }] } } },
        ],
        "command.equipment": { target: "equipment", actions: enterHeading },
        "command.edit-party": {
          target: "party",
          actions: assign(({ context }) => ({ ...heading, party: prepareParty(context, "edit"), focus: null })),
        },
        "command.save": {
          target: "confirm",
          actions: assign({ ...heading, confirmation: "save", focus: { kind: "command", command: "cancel" } }),
        },
        "command.save-title": {
          target: "confirm",
          actions: assign({
            ...heading,
            confirmation: "save-title",
            focus: { kind: "command", command: "cancel" },
          }),
        },
        "command.title": {
          target: "confirm",
          actions: assign({ ...heading, confirmation: "title", focus: { kind: "command", command: "cancel" } }),
        },
      },
    },
    equipment: {
      on: {
        "command.home": { target: "home", actions: enterHeading },
        equip: {
          actions: assign(({ context, event }) => {
            const changed = editHomeEquipment(
              context.game,
              "home",
              event.characterId,
              event.slot,
              event.instanceId,
              characters,
              campaignRules,
            );
            return {
              ...heading,
              game: changed.state,
              message: changed.accepted ? "装備を変更しました。" : "装備を変更できませんでした。",
            };
          }),
        },
      },
    },
    destinations: {
      on: {
        "command.home": { target: "home", actions: enterHeading },
        escape: { target: "home", actions: enterHeading },
        "command.town": [
          { guard: ({ context }) => hasPendingGrowth(context.game), target: "growth", actions: enterGrowth },
          { target: "town", actions: enterTown },
        ],
        "command.prepare-departure": {
          target: "party",
          actions: assign(({ context }) => ({
            ...heading,
            party: prepareParty(context, "departure"),
            focus: null,
          })),
        },
      },
    },
    party: {
      exit: assign({ party: null }),
      on: {
        party: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            if (!context.party) return;
            const changed = reduceParty(
              { ...context.party.party, input: partyInput(context, context.party.context) },
              event.event,
            );
            const { input, ...party } = changed.state;
            enqueue.assign({ game: input.game, party: { ...context.party, party } });
            enqueue({ type: "output", params: { handled: changed.handled, effects: [] } });
            for (const effect of changed.effects)
              if (effect.type === "navigate")
                enqueue.raise({
                  type:
                    effect.destination === "dungeon"
                      ? "party-dungeon"
                      : effect.destination === "destinations"
                        ? "party-destinations"
                        : "party-home",
                });
          }),
        },
        "party-home": {
          target: "home",
          actions: assign({ ...heading, focus: { kind: "command", command: "edit-party" } }),
        },
        "party-destinations": {
          target: "destinations",
          actions: assign({ ...heading, focus: { kind: "command", command: "prepare-departure" } }),
        },
        "party-dungeon": {
          target: "dungeon",
          actions: assign(({ context }) => ({
            ...heading,
            expedition: createDungeonModel(dungeonInput(context)),
            carryQuantity: 0,
            completion: undefined,
            focus: null,
          })),
        },
      },
    },
    town: {
      on: {
        "command.home": {
          guard: ({ context }) => context.game.adventure.mode === "town",
          target: "home",
          actions: enterHeading,
        },
        town: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            const changed = reduceTown(context.town, event.event, townInput(context));
            enqueue.assign({
              town: changed.state,
              game: changed.game,
              carryQuantity: changed.action?.accepted && event.event.type === "select" ? 0 : context.carryQuantity,
              completion: changed.action?.accepted ? changed.completion : context.completion,
              focus:
                changed.state.focus?.kind === "place"
                  ? { kind: "town-place", placeId: changed.state.focus.placeId }
                  : null,
            });
            enqueue({ type: "output", params: { handled: changed.handled, effects: [], townResult: changed.action } });
            if (changed.home) enqueue.raise({ type: "town-home" });
            else if (changed.action?.accepted && hasPendingGrowth(changed.game)) enqueue.raise({ type: "town-growth" });
          }),
        },
        "town-home": { target: "home", actions: enterHeading },
        "town-growth": { target: "growth", actions: enterGrowth },
      },
    },
    growth: {
      on: {
        growth: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            const choice = context.game.growth?.choice;
            if (!choice) return;
            if (event.event.type === "choose") {
              const changed = chooseGrowthSkill(context.game, event.event.skillId, campaignRules);
              if (!changed.accepted) return;
              enqueue.assign({ game: changed.state });
              enqueue.raise({ type: "growth-done" });
              return;
            }
            const moved = reduceGrowthPresentation(
              context.focus?.kind === "growth-heading"
                ? { kind: "heading" }
                : context.focus?.kind === "growth-candidate"
                  ? { kind: "candidate", skillId: context.focus.skillId }
                  : null,
              event.event,
              choice,
            );
            if (moved.handled)
              enqueue.assign({
                focus:
                  moved.focus?.kind === "heading"
                    ? { kind: "growth-heading" }
                    : moved.focus?.kind === "candidate"
                      ? { kind: "growth-candidate", skillId: moved.focus.skillId }
                      : null,
              });
          }),
        },
        "growth-done": [
          { guard: ({ context }) => hasPendingGrowth(context.game), actions: enterGrowth },
          { target: "town", actions: enterTown },
        ],
      },
    },
    dungeon: {
      on: {
        dungeon: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            if (!context.expedition) return;
            const input = dungeonInput(context, event.enemyDepths),
              changed = reduceDungeon(context.expedition, input, event.event);
            if (changed.state !== context.expedition || changed.game !== context.game)
              enqueue.assign({
                game: changed.game,
                expedition: changed.state,
                completion: changed.completion ?? context.completion,
              });
            let effects = changed.effects;
            if (changed.returnRequested) {
              const returned = changed.game.dungeon
                ? leaveExpedition(changed.game, campaignRules)
                : { accepted: true, state: changed.game, completion: changed.completion ?? context.completion };
              if (returned.accepted) {
                const closed = reduceDungeon(changed.state, { ...input, game: returned.state }, { type: "closed" });
                enqueue.assign({ game: returned.state, expedition: null, completion: returned.completion });
                enqueue.raise({ type: "expedition-returned" });
                effects = [...effects, ...closed.effects];
              }
            }
            enqueue({
              type: "output",
              params: {
                handled: changed.handled,
                effects: effects.map((effect) => ({ type: "dungeon", effect })),
                dungeonResult: changed.result,
              },
            });
          }),
        },
        "expedition-returned": { target: "home", actions: enterHeading },
      },
    },
    disposed: { on: { focused: {} } },
  },
});
export type CampaignModel = SnapshotFrom<typeof campaignMachine>;
export function createCampaignModel(): CampaignModel {
  return initialTransition(campaignMachine)[0];
}
export function campaignTownInput(state: CampaignModel): TownInput {
  return townInput(state.context);
}
export function campaignDungeonInput(state: CampaignModel, enemyDepths: BattleInput["enemyDepths"] = []): DungeonInput {
  return dungeonInput(state.context, enemyDepths);
}
/** Campaign owns the game; the child retains only its uncommitted screen state. */
export function campaignPartyModel(state: CampaignModel, party: CampaignParty): PartyModel {
  return { ...party.party, input: partyInput(state.context, party.context) };
}
export function reduceCampaign(
  state: CampaignModel,
  event: CampaignEvent,
  enemyDepths: BattleInput["enemyDepths"] = [],
): CampaignTransition {
  const [next, actions] = transition(
    campaignMachine,
    state,
    event.type === "command"
      ? { type: `command.${event.command}` }
      : event.type === "dungeon"
        ? { ...event, enemyDepths }
        : event,
  );
  const output = actions.find((action) => action.type === "output");
  return { state: next, effects: [], handled: next !== state, ...output?.params };
}
