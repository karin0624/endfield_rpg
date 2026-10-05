import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { campaignRules, createCampaignGame } from "./campaignModel";
import {
  createTownState,
  projectTownShop,
  reduceTown,
  type TownEvent,
  type TownInput,
  type TownState,
} from "./townModel";
import { projectTown } from "./townProjection";

function start(): { state: TownState; input: TownInput } {
  return {
    state: createTownState("town-square"),
    input: {
      game: createCampaignGame(),
      characters,
      definition: initialAdventure,
      rules: campaignRules,
      items: [],
      partyEntry: true,
      shopEnabled: true,
    } satisfies TownInput,
  };
}
function send(current: { state: TownState; input: TownInput }, event: TownEvent) {
  const next = reduceTown(current.state, event, current.input);
  return { state: next.state, input: { ...current.input, game: next.game } };
}
const project = (current: ReturnType<typeof start>) =>
  projectTown(current.state, current.input, {
    calendar: "1日目 · 昼",
    feedback: [],
    home: true,
    debug: false,
    editorEntry: false,
    saveStatus: "",
  });

describe("実セッションに結線した街の画面状態", () => {
  it("会話・文字入力・blurを現在状態へ適用し、完了時だけ生活時計と回復を確定する", () => {
    const source = start();
    const before = structuredClone(source.input.game);
    let current = send(source, { type: "select", placeId: "guild" });
    current = send(current, { type: "input-context", context: "text-entry" });
    expect(reduceTown(current.state, { type: "key", code: "Space" }, current.input).handled).toBe(false);
    current = send(current, { type: "input-context", context: "screen" });
    current = send(current, { type: "key", code: "Space" });
    expect(project(current).adventure.scene?.text).toBe("ギルベルタが掲示板の前で会釈した。");
    current = send(current, { type: "key", code: "Space" });
    expect(reduceTown(current.state, { type: "advance" }, current.input).handled).toBe(false);
    expect(reduceTown(current.state, { type: "home" }, current.input).handled).toBe(false);
    current = send(current, { type: "key", code: "Digit2" });
    expect(current.input.game).toMatchObject({
      adventure: { mode: "town", flags: ["visited-guild"] },
      clock: { elapsedHalfDays: 1, recoverySteps: 1 },
    });
    expect(project(current).adventure.focus).toEqual({ kind: "place", placeId: "guild" });
    expect(reduceTown(current.state, { type: "home" }, current.input).home).toBe(true);
    expect(source.input.game).toEqual(before);
  });

  it("加入結果の人物名と場所へ戻るfocusを投影し、編成を勝手に変えない", () => {
    let current = send(start(), { type: "select", placeId: "find-companion" });
    current = send(current, { type: "advance" });
    current = send(current, { type: "choose", optionId: "invite-gilberta" });
    expect(current.input.game.party.members.map(({ id }) => id)).toEqual(["player", "gilberta"]);
    expect(current.input.game.party.slots).toEqual(["player", null, null, null]);
    expect(project(current).adventure).toMatchObject({
      prompt: "ギルベルタが仲間に加わった。",
      focus: { kind: "place", placeId: "find-companion" },
    });
  });

  it("現在残高で繰り返し購入し、数量・バッグ・元入力・時刻と乱数を守る", () => {
    const source = start();
    let current = send(source, { type: "select", placeId: "market" });
    const before = structuredClone(current.input.game);
    current = send(current, { type: "shop-open" });
    expect(projectTownShop(current.state, current.input)).toMatchObject({
      open: true,
      quantity: 1,
      focus: "quantity",
      canBuy: true,
      summary: "所持金 30 · 探索バッグ 0個",
    });
    expect(reduceTown(current.state, { type: "advance" }, current.input).handled).toBe(false);
    expect(reduceTown(current.state, { type: "key", code: "Space" }, current.input).handled).toBe(false);
    current = send(current, { type: "shop-buy" });
    current = send(current, { type: "shop-buy" });
    expect(projectTownShop(current.state, current.input)).toMatchObject({
      summary: "所持金 10 · 探索バッグ 2個",
      message: "HP回復品を1個購入しました。",
    });
    current = send(current, { type: "shop-buy" });
    expect(current.input.game.inventory?.balance).toBe(0);
    expect(current.input.game.inventory?.items.exploration?.bag).toEqual([
      { itemId: "hp-recovery", quantity: 3, origin: "acquired" },
    ]);
    const exhausted = structuredClone(current.input.game);
    expect(reduceTown(current.state, { type: "shop-buy" }, current.input)).toMatchObject({
      handled: false,
      game: exhausted,
    });
    expect(current.input.game.clock).toEqual(before.clock);
    expect(current.input.game.randomState).toBe(before.randomState);
    expect(before.inventory?.balance).toBe(30);
    expect(source.input.game.inventory?.items.exploration).toBeNull();
  });

  it("買物draftと閉じたdialogへの不成立入力を保持し、再openした現在dialogでまた受理する", () => {
    let current = send(send(start(), { type: "select", placeId: "market" }), { type: "shop-open" });
    const before = structuredClone(current.input.game);
    for (const quantity of [null, 0, -1, 0.5, 4, Number.MAX_SAFE_INTEGER]) {
      const draft = send(current, { type: "shop-quantity", quantity });
      expect(projectTownShop(draft.state, draft.input).canBuy).toBe(false);
      expect(reduceTown(draft.state, { type: "shop-buy" }, draft.input)).toMatchObject({
        handled: false,
        game: before,
      });
    }
    current = send(current, { type: "shop-quantity", quantity: 2 });
    current = send(current, { type: "key", code: "Escape" });
    expect(projectTownShop(current.state, current.input)).toMatchObject({ open: false, quantity: 2, focus: "trigger" });
    expect(reduceTown(current.state, { type: "shop-buy" }, current.input).handled).toBe(false);
    current = send(current, { type: "shop-open" });
    current = send(current, { type: "shop-buy" });
    expect(current.input.game.inventory?.balance).toBe(10);
    current = send(current, { type: "shop-close" });
    current = send(current, { type: "advance" });
    expect(projectTownShop(current.state, current.input)).toMatchObject({ visible: false, open: false });
    expect(reduceTown(current.state, { type: "shop-open" }, current.input).handled).toBe(false);
    expect(current.input.game.inventory?.items.home).toEqual([{ itemId: "hp-recovery", quantity: 2 }]);
    expect(current.input.game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
  });

  it("買物dialogのfocusを現在の購入可否で巡回し、取消後は入口へ戻す", () => {
    let current = send(send(start(), { type: "select", placeId: "market" }), { type: "shop-open" });
    const before = structuredClone(current.input.game);
    current = send(current, { type: "shop-key", key: "Tab", shift: false });
    expect(projectTownShop(current.state, current.input).focus).toBe("buy");
    current = send(current, { type: "shop-key", key: "Tab", shift: false });
    expect(projectTownShop(current.state, current.input).focus).toBe("close");
    current = send(current, { type: "shop-key", key: "Tab", shift: false });
    expect(projectTownShop(current.state, current.input).focus).toBe("quantity");
    current = send(current, { type: "shop-key", key: "Tab", shift: true });
    expect(projectTownShop(current.state, current.input).focus).toBe("close");
    current = send(current, { type: "shop-focused", target: "quantity" });
    current = send(current, { type: "shop-quantity", quantity: 4 });
    current = send(current, { type: "shop-key", key: "Tab", shift: false });
    expect(projectTownShop(current.state, current.input).focus).toBe("close");
    expect(reduceTown(current.state, { type: "shop-key", key: "Enter", shift: false }, current.input).handled).toBe(
      false,
    );
    current = send(current, { type: "shop-key", key: "Escape", shift: false });
    expect(projectTownShop(current.state, current.input)).toMatchObject({ open: false, focus: "trigger" });
    expect(current.input.game).toEqual(before);
    current = send(current, { type: "advance" });
    current = send(current, { type: "focused", target: { kind: "place", placeId: "market" } });
    expect(project(current).adventure.focus).toEqual({ kind: "place", placeId: "market" });
    expect(projectTownShop(current.state, current.input).focus).toBeNull();
  });

  it("編成の正当なtoggle2回を受理し、closed→open→confirmを現在の画面で処理する", () => {
    const source = start();
    const before = structuredClone(source.input.game);
    let current = send(source, { type: "open-party" });
    expect(project(current).adventure.party?.focus).toEqual({ kind: "back" });
    expect(project(current).adventure.focus).toBeNull();
    expect(reduceTown(current.state, { type: "select", placeId: "market" }, current.input).handled).toBe(false);
    current = send(current, { type: "party", event: { type: "open-selection", slot: 0 } });
    current = send(current, { type: "party", event: { type: "toggle", characterId: "player" } });
    current = send(current, { type: "party", event: { type: "toggle", characterId: "player" } });
    expect(current.input.game).toEqual(before);
    current = send(current, { type: "party", event: { type: "confirm" } });
    expect(current.input.game.party.slots).toEqual(["player", null, null, null]);
    current = send(current, { type: "party", event: { type: "back" } });
    expect(project(current).adventure).toMatchObject({ focus: { kind: "party-entry" }, party: undefined });
    expect(reduceTown(current.state, { type: "party", event: { type: "confirm" } }, current.input).handled).toBe(false);
    current = send(current, { type: "open-party" });
    current = send(current, { type: "party", event: { type: "open-selection", slot: 0 } });
    current = send(current, { type: "party", event: { type: "toggle", characterId: "player" } });
    current = send(current, { type: "party", event: { type: "confirm" } });
    expect(current.input.game.party.slots).toEqual([null, null, null, null]);
    expect(source.input.game).toEqual(before);
  });
});
