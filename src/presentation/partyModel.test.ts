import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "../game/createInitialGameState";
import { applyPartyStatus, type ExpeditionGame } from "../game/expedition";
import { type CharacterDefinition, createParty, type PartySlots } from "../game/party";
import { createActionClock } from "../game/time";
import {
  createPartyModel,
  isUnchangedPartyFocus,
  type PartyEvent,
  type PartyInput,
  type PartyModel,
  reduceParty,
} from "./partyModel";
import { projectParty } from "./partyProjection";

const companions: readonly CharacterDefinition[] = [
  ...characters,
  { id: "scout", name: "斥候", maxHp: 24, speed: 95, attackPower: 7 },
  { id: "guard", name: "衛兵", maxHp: 28, speed: 80, attackPower: 9 },
  { id: "reserve", name: "控え", maxHp: 16, speed: 100, attackPower: 5 },
];
function input(slots: PartySlots = ["player", "gilberta", "scout", "guard"]): PartyInput {
  return {
    game: {
      adventure: createInitialGameState(initialGameOptions),
      party: {
        ...createParty(
          companions,
          companions.map(({ id }) => id),
        ),
        slots,
      },
      dungeon: null,
      randomState: 731,
      clock: createActionClock(),
    },
    characters: companions,
    calendarLabel: "1日目 · 昼",
    departure: { characters: companions, route: initialDungeon, adventure: initialAdventure },
  };
}
const send = (state: PartyModel, event: PartyEvent) => reduceParty(state, event).state;
function selected(state: PartyModel) {
  const frame = projectParty(state).selection;
  if (!frame) throw new Error("仲間選択が開かれていません");
  return frame.candidates.map(({ id, number }) => [id, number]);
}

describe("編成の現在状態と意味イベント", () => {
  it("無変更focused契約は開いた画面だけ受理し、詳細中・閉状態・破棄後を区別する", () => {
    const initial = createPartyModel(input(), "home");
    const target = { kind: "back" } as const;
    const focused = { type: "focused", target } as const;
    expect(isUnchangedPartyFocus(initial, target)).toBe(true);
    expect(reduceParty(initial, focused)).toEqual({ state: initial, handled: true, effects: [] });
    expect(reduceParty(initial, focused).state).toBe(initial);
    expect(isUnchangedPartyFocus({ ...initial, focus: null }, target)).toBe(false);
    const selection = send(initial, { type: "open-selection", slot: 1 });
    const dialog = send(selection, { type: "show-details", characterId: "player" });
    const closed = send(initial, { type: "back" });
    const disposed = send(initial, { type: "disposed" });
    for (const state of [dialog, closed, disposed]) {
      // Even an equal target cannot turn an ignored notification into an accepted one.
      const currentTarget = state.focus ?? target;
      expect(isUnchangedPartyFocus(state, currentTarget)).toBe(false);
      const ignored = reduceParty(state, { type: "focused", target: currentTarget });
      expect(ignored).toEqual({ state, handled: false, effects: [] });
      expect(ignored.state).toBe(state);
    }
  });
  it("候補切替は毎回有効で、確定・再表示・再確定は現在の画面で受理する", () => {
    const source = input(["player", null, null, null]);
    const before = structuredClone(source.game);
    let state = createPartyModel(source, "destinations");
    state = send(state, { type: "open-selection", slot: 2 });
    state = send(state, { type: "toggle", characterId: "player" });
    expect(selected(state)).toContainEqual(["player", 0]);
    state = send(state, { type: "toggle", characterId: "player" });
    expect(selected(state)).toContainEqual(["player", 1]);
    state = send(state, { type: "toggle", characterId: "gilberta" });
    const confirmed = reduceParty(state, { type: "confirm" });
    expect(confirmed.state.input.game.party.slots).toEqual(["player", "gilberta", null, null]);
    expect(confirmed.state.focus).toEqual({ kind: "slot", slot: 2 });
    expect(confirmed.effects).toEqual([
      {
        type: "game-changed",
        game: { ...before, party: { ...before.party, slots: ["player", "gilberta", null, null] } },
      },
    ]);
    expect(reduceParty(confirmed.state, { type: "confirm" })).toMatchObject({ handled: false, effects: [] });
    state = send(confirmed.state, { type: "open-selection", slot: 0 });
    state = send(state, { type: "toggle", characterId: "player" });
    const again = reduceParty(state, { type: "confirm" });
    expect(again.state.input.game.party.slots).toEqual(["gilberta", null, null, null]);
    expect(again.effects).toHaveLength(1);
    expect(source.game).toEqual(before);
  });

  it("draft の欠番を保持し最小の空きへ追加、Esc 確定時だけ隊列を詰める", () => {
    const source = input();
    const before = structuredClone(source.game);
    let state = send(createPartyModel(source, "home"), { type: "open-selection", slot: 1 });
    state = send(state, { type: "toggle", characterId: "gilberta" });
    expect(selected(state)).toEqual([
      ["player", 1],
      ["gilberta", 0],
      ["scout", 3],
      ["guard", 4],
      ["reserve", 0],
    ]);
    state = send(state, { type: "toggle", characterId: "player" });
    state = send(state, { type: "toggle", characterId: "reserve" });
    expect(selected(state)).toEqual([
      ["player", 0],
      ["gilberta", 0],
      ["scout", 3],
      ["guard", 4],
      ["reserve", 1],
    ]);
    expect(state.input.game).toEqual(before);
    state = send(state, { type: "key", key: "Escape", shift: false });
    expect(state.input.game).toEqual({
      ...before,
      party: { ...before.party, slots: ["reserve", "scout", "guard", null] },
    });
    expect(projectParty(state).selection).toBeNull();
    expect(state.focus).toEqual({ kind: "slot", slot: 1 });
  });

  it("満員の候補は既存隊列を追い出さず、詳細の読取りは許可する", () => {
    const source = input();
    const before = structuredClone(source.game);
    let state = send(createPartyModel(source, "home"), { type: "open-selection", slot: 0 });
    state = send(state, { type: "toggle", characterId: "reserve" });
    expect(projectParty(state).selection).toMatchObject({
      status: "出撃は4人までです。選択済みの仲間を外すと追加できます。",
    });
    expect(selected(state)).toContainEqual(["reserve", 0]);
    const candidate = projectParty(state).selection?.candidates.find(({ id }) => id === "reserve");
    expect(candidate).toMatchObject({
      unavailable: true,
      reason: "出撃は4人までです。選択済みの仲間を外すと追加できます。",
    });
    state = send(state, { type: "show-details", characterId: "reserve" });
    expect(state.details.dialog).toMatchObject({ name: "控え", portrait: undefined });
    expect(state.input.game).toEqual(before);
  });

  it("詳細中は背景操作を受けず、draft/scroll を保持して元の詳細 focus へ戻る", () => {
    const source = input();
    const before = structuredClone(source.game);
    let state = send(createPartyModel(source, "home"), { type: "open-selection", slot: 3 });
    state = send(state, { type: "toggle", characterId: "gilberta" });
    state = send(state, { type: "selection-scrolled", scrollTop: 420 });
    state = send(state, { type: "show-details", characterId: "reserve" });
    expect(state.details.focus).toEqual({ kind: "back" });
    for (const event of [
      { type: "toggle", characterId: "player" },
      { type: "confirm" },
      { type: "depart" },
      { type: "back" },
    ] as const)
      expect(reduceParty(state, event)).toMatchObject({ handled: false, effects: [] });
    state = send(state, { type: "key", key: "Tab", shift: false });
    expect(state.details.focus).toEqual({ kind: "information" });
    state = send(state, { type: "key", key: "Tab", shift: true });
    expect(state.details.focus).toEqual({ kind: "back" });
    state = send(state, { type: "key", key: "Escape", shift: false });
    expect(state.details.dialog).toBeNull();
    expect(state.focus).toEqual({ kind: "detail", characterId: "reserve" });
    expect(projectParty(state).selection?.scrollTop).toBe(420);
    expect(selected(state)).toContainEqual(["scout", 3]);
    expect(state.input.game).toEqual(before);
    state = send(state, { type: "show-details", characterId: "reserve" });
    state = send(state, { type: "details", event: { type: "close" } });
    expect(state.details.dialog).toBeNull();
    expect(state.focus).toEqual({ kind: "detail", characterId: "reserve" });
  });

  it("keyboard focus は候補・詳細・確定の意味対象を巡回し、逆順でも背景へ抜けない", () => {
    let state = send(createPartyModel(input(), "home"), { type: "open-selection", slot: 0 });
    state = send(state, { type: "key", key: "Tab", shift: true });
    expect(state.focus).toEqual({ kind: "confirm" });
    state = send(state, { type: "key", key: "Tab", shift: false });
    expect(state.focus).toEqual({ kind: "candidate", characterId: "player" });
    for (let index = 0; index < 9; index++) state = send(state, { type: "key", key: "Tab", shift: false });
    expect(state.focus).toEqual({ kind: "detail", characterId: "reserve" });
    expect(reduceParty(state, { type: "key", key: " ", shift: false }).handled).toBe(false);
  });

  it("空編成は確定できるが出発できず、編集専用画面には出発操作がない", () => {
    let state = send(createPartyModel(input(["player", null, null, null]), "destinations"), {
      type: "open-selection",
      slot: 0,
    });
    state = send(state, { type: "toggle", characterId: "player" });
    state = send(state, { type: "confirm" });
    expect(state.input.game.party.slots).toEqual([null, null, null, null]);
    expect(projectParty(state)).toMatchObject({
      departure: { visible: true, disabled: true },
      status: "出撃する仲間を1人以上選んでください。",
    });
    const departed = reduceParty(state, { type: "depart" });
    expect(departed.effects).toEqual([]);
    expect(departed.state.input.game.dungeon).toBeNull();
    const edit = createPartyModel({ ...input(), departure: undefined }, "home");
    expect(projectParty(edit)).toMatchObject({ title: "編成", departure: { visible: false } });
    expect(reduceParty(edit, { type: "depart" }).handled).toBe(false);
  });

  it("出発は現在の隊列を実コアへ渡し、ゲームと画面の遷移を同時に確定する", () => {
    const source = input(["gilberta", "player", null, null]);
    const before = structuredClone(source.game);
    const next = reduceParty(createPartyModel(source, "destinations"), { type: "depart" });
    expect(next.state.input.game.dungeon?.party.map(({ id, hp }) => ({ id, hp }))).toEqual([
      { id: "gilberta", hp: 18 },
      { id: "player", hp: 20 },
    ]);
    expect(next.state.panel).toEqual({ kind: "closed", destination: "dungeon" });
    expect(next.effects.map(({ type }) => type)).toEqual(["game-changed", "navigate"]);
    expect(reduceParty(next.state, { type: "depart" })).toMatchObject({ handled: false, effects: [] });
    expect(source.game).toEqual(before);
  });

  it("現在の街/探索状態が許可しない確定は draft とゲームを保持して理由を返す", () => {
    const departed = reduceParty(createPartyModel(input(), "destinations"), { type: "depart" }).state.input.game;
    const source = { ...input(), game: departed };
    const before = structuredClone(source.game);
    let state = send(createPartyModel(source, "home"), { type: "open-selection", slot: 0 });
    state = send(state, { type: "toggle", characterId: "player" });
    const next = reduceParty(state, { type: "confirm" });
    expect(next.effects).toEqual([]);
    expect(projectParty(next.state).selection?.status).toBe("編成と出撃は街で行ってください。");
    expect(next.state.input.game).toEqual(before);
  });

  it("戻った後に画面を開き直せば同じ戻る操作を再び受理する", () => {
    const source = input();
    const closed = reduceParty(createPartyModel(source, "town"), { type: "back" });
    expect(closed.state.panel).toEqual({ kind: "closed", destination: "town" });
    expect(closed.effects).toEqual([{ type: "navigate", destination: "town" }]);
    expect(reduceParty(closed.state, { type: "back" }).handled).toBe(false);
    const reopened = send(closed.state, { type: "shown", input: source });
    expect(reduceParty(reopened, { type: "back" }).effects).toEqual([{ type: "navigate", destination: "town" }]);
  });

  it("編成を開き直した詳細には新しい人物を描き、旧表示の画像結果を持ち越さない", () => {
    const source = input();
    let state = send(createPartyModel(source, "town"), { type: "open-selection", slot: 0 });
    state = send(state, { type: "show-details", characterId: "player" });
    const previousImage = state.details.generation;
    state = send(state, { type: "details", event: { type: "close" } });
    state = send(state, { type: "confirm" });
    state = send(state, { type: "back" });
    state = send(state, { type: "shown", input: source });
    state = send(state, { type: "open-selection", slot: 1 });
    state = send(state, { type: "show-details", characterId: "gilberta" });
    state = send(state, { type: "details", event: { type: "portrait-failed", generation: previousImage } });
    expect(state.details.dialog).toMatchObject({ id: "gilberta", name: "ギルベルタ", portraitFailed: false });
  });

  it("通常編成の focus は枠と利用可能な操作を巡回し、出発不可の理由を保持する", () => {
    const source = input();
    let state = createPartyModel(source, "home");
    state = send(state, { type: "key", key: "Tab", shift: false });
    expect(state.focus).toEqual({ kind: "depart" });
    state = send(state, { type: "key", key: "Tab", shift: false });
    expect(state.focus).toEqual({ kind: "slot", slot: 0 });
    state = send(state, { type: "focused", target: { kind: "slot", slot: 3 } });
    state = send(state, { type: "key", key: "Tab", shift: false });
    expect(state.focus).toEqual({ kind: "back" });
    const unavailable = {
      ...source,
      game: {
        ...source.game,
        party: { ...source.game.party, members: source.game.party.members.map((member) => ({ ...member, hp: 0 })) },
      },
    };
    state = createPartyModel(unavailable, "destinations");
    expect(projectParty(state)).toMatchObject({
      departure: { disabled: true },
      status: "出撃できる仲間がいません。街探索で回復を進められます。",
    });
    const rejected = reduceParty(state, { type: "depart" });
    expect(rejected.effects).toEqual([]);
    expect(rejected.state.input.game).toEqual(unavailable.game);
    expect(projectParty(rejected.state).status).toBe("出撃できる仲間がいません。街探索で回復を進められます。");
  });

  it("画像失敗は現在表示を fallback にし、前の表示の結果と退出後入力は適用しない", () => {
    const source = input();
    let state = createPartyModel(source, "home");
    const oldImage = state.portraits.generation;
    state = send(state, { type: "refreshed", input: source });
    state = send(state, { type: "portrait-failed", generation: oldImage, characterId: "player" });
    expect(projectParty(state).slots[0].member?.portrait).toBe("characters/rossi/expressions/neutral.png");
    state = send(state, { type: "portrait-failed", generation: state.portraits.generation, characterId: "player" });
    expect(projectParty(state).slots[0].member?.portrait).toBeUndefined();
    state = send(state, { type: "portrait-failed", generation: state.portraits.generation, characterId: "player" });
    expect(projectParty(state).slots[0].member?.name).toBe("ロッシ");
    state = send(state, { type: "open-selection", slot: 0 });
    expect(projectParty(state).selection?.candidates[0]).toMatchObject({ portrait: undefined, number: 1 });
    state = send(state, { type: "disposed" });
    expect(projectParty(state).visible).toBe(false);
    expect(reduceParty(state, { type: "shown", input: source }).handled).toBe(false);
    expect(reduceParty(state, { type: "portrait-failed", generation: oldImage, characterId: "player" }).handled).toBe(
      false,
    );
  });

  it("仲間がいなくても空の候補と確定 focus を表示し、ゲーム状態を保持できる", () => {
    const source = input([null, null, null, null]);
    const empty = { ...source, game: { ...source.game, party: createParty(companions, []) } };
    let state = send(createPartyModel(empty, "home"), { type: "open-selection", slot: 0 });
    expect(projectParty(state).selection?.candidates).toEqual([]);
    expect(state.focus).toEqual({ kind: "confirm" });
    state = send(state, { type: "focused", target: { kind: "confirm" } });
    state = send(state, { type: "key", key: "Tab", shift: false });
    expect(state.focus).toEqual({ kind: "confirm" });
    state = send(state, { type: "confirm" });
    expect(state.input.game).toEqual(empty.game);
  });

  it("詳細を開くたび現在値を投影し、閲覧・focus・画像失敗でゲームを変更しない", () => {
    const source = input(["player", null, null, null]);
    let state = send(createPartyModel(source, "home"), { type: "open-selection", slot: 0 });
    state = send(state, { type: "show-details", characterId: "player" });
    expect(state.details.dialog?.stats.find(([label]) => label === "HP")).toEqual(["HP", "20 / 20", ""]);
    const oldImage = state.details.generation;
    state = send(state, { type: "details", event: { type: "close" } });
    const damaged = applyPartyStatus(source.game, "player", { kind: "physicalFatigue", amount: 25 }, companions);
    const changed: ExpeditionGame = {
      ...damaged,
      party: {
        ...damaged.party,
        members: damaged.party.members.map((member) =>
          member.id === "player" ? { ...member, mentalFatigue: 12 } : member,
        ),
      },
    };
    const before = structuredClone(changed);
    state = send(state, { type: "refreshed", input: { ...source, game: changed } });
    state = send(state, { type: "show-details", characterId: "player" });
    expect(state.details.dialog?.stats.find(([label]) => label === "HP")?.[1]).toBe("16 / 16");
    expect(state.details.dialog?.stats.find(([label]) => label === "精神疲労")?.[1]).toBe("12（なし）");
    state = send(state, { type: "details", event: { type: "portrait-failed", generation: oldImage } });
    expect(state.details.dialog?.portraitFailed).toBe(false);
    state = send(state, { type: "details", event: { type: "portrait-failed", generation: state.details.generation } });
    expect(state.details.dialog?.portraitFailed).toBe(true);
    state = send(state, { type: "key", key: "Escape", shift: false });
    expect(state.input.game).toEqual(before);
    expect(changed).toEqual(before);
    const disposed = send(state, { type: "disposed" });
    expect(reduceParty(disposed, { type: "show-details", characterId: "player" }).handled).toBe(false);
  });
});
