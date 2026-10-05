import { itemCatalog, itemSettings, recoveryItemId, recoveryItemOffer } from "../content/itemSettings";
import type { AdventureDefinition } from "../game/adventure";
import type { BattleSkillRules } from "../game/battle";
import {
  actInTown,
  beginTownExploration,
  type ExpeditionGame,
  type GameActionCompletion,
  type TownActionResult,
} from "../game/expedition";
import { grownCharacters } from "../game/growthRuntime";
import { purchaseItem } from "../game/itemPurchase";
import { bagItemQuantity, type ItemStack } from "../game/items";
import type { CharacterDefinition } from "../game/party";
import { type AdventureEvent, adventureKeyCommand, type InputContext } from "./adventureModel";
import type { AdventureFocus } from "./adventureProjection";
import { createPartyModel, type PartyModel, reduceParty } from "./partyModel";
import { calendarLabel } from "./statusText";

export interface ShopState {
  readonly open: boolean;
  readonly quantity: number | null;
  readonly message: string;
  readonly focus: "quantity" | "buy" | "close" | "trigger" | null;
}
export interface TownState {
  readonly focus: AdventureFocus;
  readonly inputContext: InputContext;
  readonly prompt: string;
  readonly party: Omit<PartyModel, "input"> | null;
  readonly shop: ShopState;
}
export interface TownInput {
  readonly game: ExpeditionGame;
  readonly characters: readonly CharacterDefinition[];
  readonly definition: AdventureDefinition;
  readonly rules: BattleSkillRules;
  readonly items: readonly ItemStack[];
  readonly partyEntry: boolean;
  readonly shopEnabled: boolean;
  readonly departure?: PartyModel["input"]["departure"];
}
export type TownEvent =
  | AdventureEvent
  | { readonly type: "shop-open" | "shop-close" | "shop-buy" }
  | { readonly type: "shop-focused"; readonly target: "quantity" | "buy" | "close" }
  | { readonly type: "shop-key"; readonly key: string; readonly shift: boolean }
  | { readonly type: "shop-quantity"; readonly quantity: number | null };
export interface TownTransition {
  readonly state: TownState;
  readonly game: ExpeditionGame;
  readonly handled: boolean;
  readonly completion?: GameActionCompletion;
  readonly action?: TownActionResult;
  readonly home?: true;
  readonly dungeon?: true;
}
export function createTownState(placeId: string): TownState {
  return {
    focus: { kind: "place", placeId },
    inputContext: "screen",
    prompt: "行き先を選ぶ",
    party: null,
    shop: { open: false, quantity: 1, message: "", focus: null },
  };
}
function partyInput(input: TownInput): PartyModel["input"] {
  const display = grownCharacters(input.game, input.rules);
  return {
    game: input.game,
    characters: display.length ? display : input.characters,
    calendarLabel: calendarLabel(input.game.clock),
    detailsContext: {
      characters: display.length ? display : input.characters,
      baseCharacters: input.characters,
      growth: input.game.growth,
      rules: input.rules,
    },
    departure: input.departure,
  };
}
export function townPartyModel(state: TownState, input: TownInput): PartyModel | null {
  return state.party && state.party.panel.kind !== "closed" ? { ...state.party, input: partyInput(input) } : null;
}
export function townShopAvailable(input: TownInput): boolean {
  return (
    input.shopEnabled &&
    input.game.adventure.mode === "conversation" &&
    input.game.adventure.currentPlaceId === "market" &&
    input.game.inventory !== undefined &&
    input.game.clock?.pendingAction?.kind === "town-exploration"
  );
}
export function townPurchaseAvailable(state: TownState, input: TownInput): boolean {
  const quantity = state.shop.quantity;
  return (
    townShopAvailable(input) &&
    input.game.inventory !== undefined &&
    quantity !== null &&
    Number.isSafeInteger(quantity) &&
    quantity > 0 &&
    Number.isSafeInteger(quantity * itemSettings.recoveryPrice) &&
    quantity * itemSettings.recoveryPrice <= input.game.inventory.balance
  );
}
export function projectTownShop(state: TownState, input: TownInput) {
  return {
    visible: townShopAvailable(input),
    open: state.shop.open,
    quantity: state.shop.quantity,
    message: state.shop.message,
    focus: state.shop.focus,
    summary: `所持金 ${input.game.inventory?.balance ?? 0} · 探索バッグ ${input.game.inventory ? bagItemQuantity(input.game.inventory.items, recoveryItemId) : 0}個`,
    offer: `HP回復品 · HP${itemSettings.hpRecovery}回復 · 価格${itemSettings.recoveryPrice}`,
    canBuy: townPurchaseAvailable(state, input),
  };
}
export function reduceTown(state: TownState, event: TownEvent, input: TownInput): TownTransition {
  const result = (next = state, game = input.game, handled = true): TownTransition => ({ state: next, game, handled });
  const ignored = () => result(state, input.game, false);
  if (event.type === "input-context")
    return result({ ...state, inputContext: event.context, focus: event.context === "control" ? state.focus : null });
  if (event.type === "focused")
    return result({ ...state, focus: event.target, inputContext: "control", shop: { ...state.shop, focus: null } });
  if (event.type === "party" && state.party && state.party.panel.kind !== "closed") {
    const changed = reduceParty({ ...state.party, input: partyInput(input) }, event.event);
    const { input: nextInput, ...party } = changed.state;
    const closed = changed.effects.some((effect) => effect.type === "navigate" && effect.destination === "town");
    const next = result(
      { ...state, party, focus: closed ? { kind: "party-entry" } : null, inputContext: closed ? "control" : "screen" },
      nextInput.game,
      changed.handled,
    );
    return changed.effects.some((effect) => effect.type === "navigate" && effect.destination === "dungeon")
      ? { ...next, dungeon: true }
      : next;
  }
  if (state.party && state.party.panel.kind !== "closed") return ignored();
  if (event.type === "shop-close" && state.shop.open)
    return result({ ...state, inputContext: "control", shop: { ...state.shop, open: false, focus: "trigger" } });
  if (state.shop.open) {
    if (event.type === "shop-focused") return result({ ...state, shop: { ...state.shop, focus: event.target } });
    if (event.type === "shop-key") {
      if (event.key === "Escape") return reduceTown(state, { type: "shop-close" }, input);
      if (event.key !== "Tab") return ignored();
      const order = ["quantity", "buy", "close"] as const;
      const current = order.findIndex((target) => target === state.shop.focus);
      for (let offset = 1; offset <= order.length; offset++) {
        const target = order[(current + (event.shift ? -offset : offset) + order.length * 2) % order.length];
        if (target !== "buy" || townPurchaseAvailable(state, input))
          return result({ ...state, shop: { ...state.shop, focus: target } });
      }
    }
    if (event.type === "key" && event.code === "Escape") return reduceTown(state, { type: "shop-close" }, input);
    if (event.type === "shop-quantity") return result({ ...state, shop: { ...state.shop, quantity: event.quantity } });
    if (
      event.type !== "shop-buy" ||
      !townPurchaseAvailable(state, input) ||
      !input.game.inventory ||
      state.shop.quantity === null
    )
      return ignored();
    const bought = purchaseItem(
      input.game.inventory.items,
      input.game.inventory.balance,
      recoveryItemOffer,
      state.shop.quantity,
      itemCatalog,
    );
    return result(
      {
        ...state,
        shop: {
          ...state.shop,
          message: bought.accepted
            ? `HP回復品を${state.shop.quantity}個購入しました。`
            : "購入できませんでした。所持金と個数を確認してください。",
        },
      },
      bought.accepted
        ? { ...input.game, inventory: { ...input.game.inventory, items: bought.items, balance: bought.balance } }
        : input.game,
    );
  }
  if (event.type === "shop-open" && townShopAvailable(input))
    return result({
      ...state,
      focus: null,
      inputContext: "text-entry",
      shop: { ...state.shop, open: true, message: "", focus: "quantity" },
    });
  if (event.type === "open-party" && input.partyEntry && input.game.adventure.mode === "town") {
    // Retain native image ownership across close/open, not input history.
    const opened = state.party
      ? reduceParty({ ...state.party, input: partyInput(input) }, { type: "shown", input: partyInput(input) }).state
      : createPartyModel(partyInput(input), "town");
    const { input: _input, ...party } = opened;
    return result({ ...state, focus: null, inputContext: "screen", party });
  }
  if (event.type === "home" && input.game.adventure.mode === "town") return { ...result(), home: true };
  if (event.type === "key") {
    const command = adventureKeyCommand(input.game.adventure, input.definition, state.inputContext, event.code);
    return command ? reduceTown(state, command, input) : ignored();
  }
  const action =
    event.type === "select"
      ? beginTownExploration(input.game, event.placeId, input.definition, input.items)
      : event.type === "advance" || event.type === "choose"
        ? actInTown(input.game, event, input.characters, input.definition, input.rules.fatigue, input.rules)
        : undefined;
  if (!action) return ignored();
  if (!action.accepted) return { ...ignored(), action };
  const names = action.completion?.recruitedIds
    ?.map((id) => input.characters.find((character) => character.id === id)?.name)
    .filter(Boolean);
  return {
    ...result(
      {
        ...state,
        inputContext: "screen",
        focus:
          action.state.adventure.mode === "town"
            ? { kind: "place", placeId: action.state.adventure.currentPlaceId }
            : null,
        prompt: names?.length ? `${names.join("・")}が仲間に加わった。` : "行き先を選ぶ",
        shop: { ...state.shop, open: false, focus: null },
      },
      action.state,
    ),
    action,
    completion: action.completion,
  };
}
