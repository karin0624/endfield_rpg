import type { AdventureDefinition } from "../game/adventure";
import type { BattleSkillRules } from "../game/battle";
import type { DungeonDefinition } from "../game/dungeon";
import {
  confirmExpeditionParty,
  departOnExpedition,
  type ExpeditionGame,
  type ExpeditionRejection,
} from "../game/expedition";
import type { ItemStack } from "../game/items";
import { type CharacterDefinition, departureRejection, type PartySlots } from "../game/party";
import {
  type CharacterDetailsInteraction,
  type CharacterDetailsModel,
  createCharacterDetailsModel,
  reduceCharacterDetails,
} from "./characterDetails";
import type { CharacterDetailsContext } from "./characterDetailsText";
import { togglePartySelection } from "./partySelection";

export type PartyFocus =
  | { readonly kind: "slot"; readonly slot: number }
  | { readonly kind: "candidate"; readonly characterId: string }
  | { readonly kind: "detail"; readonly characterId: string }
  | { readonly kind: "back" }
  | { readonly kind: "depart" }
  | { readonly kind: "confirm" };

export type PartyReturnScreen = "home" | "destinations" | "town";
export interface PartyInput {
  readonly game: ExpeditionGame;
  readonly characters: readonly CharacterDefinition[];
  readonly calendarLabel: string;
  readonly detailsContext?: CharacterDetailsContext;
  readonly departure?: {
    readonly characters: readonly CharacterDefinition[];
    readonly route: DungeonDefinition;
    readonly adventure: AdventureDefinition;
    readonly skills?: BattleSkillRules;
    readonly items?: readonly ItemStack[];
  };
}
export interface PartyModel {
  readonly input: PartyInput;
  readonly returnTo: PartyReturnScreen;
  readonly panel:
    | { readonly kind: "formation" }
    | {
        readonly kind: "selection";
        readonly draft: PartySlots;
        readonly openerSlot: number;
        readonly scrollTop: number;
        readonly rejection: ExpeditionRejection | "full-party" | null;
      }
    | { readonly kind: "closed"; readonly destination: PartyReturnScreen | "dungeon" | "disposed" };
  readonly details: CharacterDetailsModel;
  readonly focus: PartyFocus | null;
  readonly rejection: ExpeditionRejection | null;
  /** The current display owns these image requests; the token only identifies late asset results. */
  readonly portraits: { readonly generation: number; readonly failed: readonly string[] };
}
export type PartyEvent =
  | { readonly type: "shown"; readonly input: PartyInput }
  | { readonly type: "refreshed"; readonly input: PartyInput }
  | { readonly type: "open-selection"; readonly slot: number }
  | { readonly type: "toggle"; readonly characterId: string }
  | { readonly type: "selection-scrolled"; readonly scrollTop: number }
  | { readonly type: "focused"; readonly target: PartyFocus }
  | { readonly type: "show-details"; readonly characterId: string }
  | {
      readonly type: "details";
      readonly event: CharacterDetailsInteraction;
    }
  | { readonly type: "portrait-failed"; readonly characterId: string; readonly generation: number }
  | { readonly type: "confirm" }
  | { readonly type: "depart" }
  | { readonly type: "back" }
  | { readonly type: "disposed" }
  | { readonly type: "key"; readonly key: string; readonly shift: boolean };
export type PartyEffect =
  | { readonly type: "game-changed"; readonly game: ExpeditionGame }
  | { readonly type: "navigate"; readonly destination: PartyReturnScreen | "dungeon" };
export interface PartyTransition {
  readonly state: PartyModel;
  readonly effects: readonly PartyEffect[];
  readonly handled: boolean;
}
export function createPartyModel(input: PartyInput, returnTo: PartyReturnScreen): PartyModel {
  return {
    input,
    returnTo,
    panel: { kind: "formation" },
    details: createCharacterDetailsModel(),
    focus: { kind: "back" },
    rejection: null,
    portraits: { generation: 0, failed: [] },
  };
}
const focusKey = (target: PartyFocus): string =>
  target.kind === "slot"
    ? `slot:${target.slot}`
    : "characterId" in target
      ? `${target.kind}:${target.characterId}`
      : target.kind;
function focusOrder(state: PartyModel): readonly PartyFocus[] {
  if (state.panel.kind === "selection")
    return [
      ...state.input.game.party.members.flatMap(({ id }) => [
        { kind: "candidate" as const, characterId: id },
        { kind: "detail" as const, characterId: id },
      ]),
      { kind: "confirm" },
    ];
  return [
    ...state.input.game.party.slots.map((_, slot) => ({ kind: "slot" as const, slot })),
    { kind: "back" },
    ...(state.input.departure && departureRejection(state.input.game.party) === null
      ? [{ kind: "depart" as const }]
      : []),
  ];
}
export function reduceParty(state: PartyModel, event: PartyEvent): PartyTransition {
  const result = (next = state, effects: readonly PartyEffect[] = [], handled = true): PartyTransition => ({
    state: next,
    effects,
    handled,
  });
  if (event.type === "disposed")
    return result({
      ...state,
      panel: { kind: "closed", destination: "disposed" },
      details: reduceCharacterDetails(state.details, { type: "disposed" }).state,
      focus: null,
    });
  if (state.panel.kind === "closed" && state.panel.destination === "disposed") return result(state, [], false);
  if (event.type === "shown")
    return result({
      ...createPartyModel(event.input, state.returnTo),
      details: { ...createCharacterDetailsModel(), generation: state.details.generation },
      portraits: { generation: state.portraits.generation + 1, failed: [] },
    });
  if (state.panel.kind === "closed") return result(state, [], false);
  if (event.type === "refreshed")
    return result({
      ...state,
      input: event.input,
      portraits: { generation: state.portraits.generation + 1, failed: [] },
    });
  if (event.type === "portrait-failed")
    return event.generation === state.portraits.generation
      ? result(
          state.portraits.failed.includes(event.characterId)
            ? state
            : { ...state, portraits: { ...state.portraits, failed: [...state.portraits.failed, event.characterId] } },
        )
      : result(state, [], false);
  if (event.type === "details") {
    const next = reduceCharacterDetails(state.details, event.event);
    return result(
      next.state === state.details
        ? state
        : {
            ...state,
            details: next.state,
            focus:
              next.state.focus?.kind === "opener"
                ? { kind: "detail", characterId: next.state.focus.characterId }
                : state.focus,
          },
      [],
      next.handled,
    );
  }
  if (state.details.dialog)
    return event.type === "key" ? reduceParty(state, { type: "details", event }) : result(state, [], false);
  if (event.type === "focused")
    return result(
      state.focus && focusKey(state.focus) === focusKey(event.target) ? state : { ...state, focus: event.target },
    );
  if (event.type === "open-selection" && state.panel.kind === "formation") {
    const first = state.input.game.party.members[0];
    return result({
      ...state,
      panel: {
        kind: "selection",
        draft: [...state.input.game.party.slots],
        openerSlot: event.slot,
        scrollTop: 0,
        rejection: null,
      },
      focus: first ? { kind: "candidate", characterId: first.id } : { kind: "confirm" },
    });
  }
  if (event.type === "toggle" && state.panel.kind === "selection") {
    const draft = togglePartySelection(state.panel.draft, event.characterId);
    return result({
      ...state,
      panel: { ...state.panel, draft, rejection: draft === state.panel.draft ? "full-party" : null },
    });
  }
  if (event.type === "selection-scrolled" && state.panel.kind === "selection")
    return result(
      state.panel.scrollTop === event.scrollTop
        ? state
        : { ...state, panel: { ...state.panel, scrollTop: event.scrollTop } },
    );
  if (event.type === "show-details" && state.panel.kind === "selection") {
    const next = reduceCharacterDetails(state.details, {
      type: "open",
      characterId: event.characterId,
      input: { characters: state.input.characters, party: state.input.game.party, context: state.input.detailsContext },
    });
    return result(next.state === state.details ? state : { ...state, details: next.state }, [], next.handled);
  }
  if (event.type === "confirm" && state.panel.kind === "selection") {
    const update = confirmExpeditionParty(state.input.game, state.panel.draft);
    return update.accepted
      ? result(
          {
            ...state,
            input: { ...state.input, game: update.state },
            panel: { kind: "formation" },
            focus: { kind: "slot", slot: state.panel.openerSlot },
            rejection: null,
          },
          [{ type: "game-changed", game: update.state }],
        )
      : result({ ...state, panel: { ...state.panel, rejection: update.reason } });
  }
  if (event.type === "back" && state.panel.kind === "formation")
    return result({ ...state, panel: { kind: "closed", destination: state.returnTo }, focus: null }, [
      { type: "navigate", destination: state.returnTo },
    ]);
  if (event.type === "depart" && state.panel.kind === "formation" && state.input.departure) {
    const { characters, route, adventure, skills, items } = state.input.departure;
    const update = departOnExpedition(state.input.game, characters, route, adventure, skills, items);
    return update.accepted
      ? result(
          {
            ...state,
            input: { ...state.input, game: update.state },
            panel: { kind: "closed", destination: "dungeon" },
            focus: null,
          },
          [
            { type: "game-changed", game: update.state },
            { type: "navigate", destination: "dungeon" },
          ],
        )
      : result({ ...state, rejection: update.reason });
  }
  if (event.type === "key") {
    if (event.key === "Escape")
      return reduceParty(state, { type: state.panel.kind === "selection" ? "confirm" : "back" });
    if (event.key === "Tab") {
      const order = focusOrder(state);
      const focus = state.focus;
      const current = focus ? order.findIndex((target) => focusKey(target) === focusKey(focus)) : -1;
      const next =
        current < 0
          ? event.shift
            ? order.length - 1
            : 0
          : (current + (event.shift ? -1 : 1) + order.length) % order.length;
      return result({ ...state, focus: order[next] });
    }
  }
  return result(state, [], false);
}
