import { describe, expect, it } from "vitest";
import { recoveryItemId } from "../content/itemSettings";
import { saveDefinitions } from "../content/saveDefinitions";
import { applyPartyStatus } from "../game/expedition";
import { rewardGrowth } from "../game/growthRuntime";
import { deserializeGame } from "../game/save";
import {
  type CampaignCommand,
  type CampaignEvent,
  type CampaignModel,
  campaignMachine,
  campaignRules,
  createCampaignModel,
  reduceCampaign,
} from "./campaignModel";
import { projectCampaign } from "./campaignProjection";
import type { PartyEvent, PartyFocus } from "./partyModel";

const send = (state: CampaignModel, event: CampaignEvent) => reduceCampaign(state, event).state;
const command = (state: CampaignModel, value: CampaignCommand) => send(state, { type: "command", command: value });
function home(): CampaignModel {
  return command(command(command(createCampaignModel(), "new-game"), "accept"), "home");
}
describe("本編の現在画面とゲーム状態", () => {
  it("本編ごとに初期ゲームの入れ子データと画面draftを独立して所有する", () => {
    const first = createCampaignModel().context;
    const second = createCampaignModel().context;
    expect(first.game.adventure).not.toBe(second.game.adventure);
    expect(first.game.adventure.flags).not.toBe(second.game.adventure.flags);
    expect(first.game.party.members).not.toBe(second.game.party.members);
    expect(first.game.party.members[0]).not.toBe(second.game.party.members[0]);
    expect(first.game.party.slots).not.toBe(second.game.party.slots);
    expect(first.game.inventory?.equipment.owned).not.toBe(second.game.inventory?.equipment.owned);
    expect(first.game.inventory?.equipment.owned[0]).not.toBe(second.game.inventory?.equipment.owned[0]);
    expect(first.game.inventory?.equipment.assignments).not.toBe(second.game.inventory?.equipment.assignments);
    expect(first.game.inventory?.items.home).not.toBe(second.game.inventory?.items.home);
    expect(first.game.inventory?.items.importantIds).not.toBe(second.game.inventory?.items.importantIds);
    expect(first.town.shop).not.toBe(second.town.shop);
    expect(first.focus).not.toBe(second.focus);
  });
  it("二つの本編を交互に操作し、保存の同期完了・再開・新規開始が他方と過去snapshotを変えない", () => {
    const firstInitial = home();
    const secondInitial = home();
    const firstBefore = structuredClone(firstInitial.context);
    const secondBefore = structuredClone(secondInitial.context);
    let first = command(command(firstInitial, "destinations"), "town");
    let second = command(secondInitial, "equipment");
    first = send(first, { type: "town", event: { type: "select", placeId: "market" } });
    const equipped = reduceCampaign(second, {
      type: "equip",
      characterId: "player",
      slot: "weapon",
      instanceId: "weapon-1",
    });
    expect(equipped.handled).toBe(true);
    expect(equipped.effects).toEqual([]);
    second = equipped.state;
    first = send(first, { type: "town", event: { type: "advance" } });
    expect(first.context.game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    expect(second.context.game.clock).toBeUndefined();
    expect(first.context.game.inventory?.equipment.assignments).toEqual([]);
    expect(second.context.game.inventory?.equipment.assignments).toEqual([
      { characterId: "player", weapon: "weapon-1", armor: null },
    ]);
    first = command(first, "home");
    const saving = reduceCampaign(command(first, "save-title"), { type: "command", command: "accept" });
    expect(saving.handled).toBe(true);
    expect(saving.state.value).toBe("saving");
    const effect = saving.effects[0];
    if (effect?.type !== "write-save") throw new Error("save");
    expect(saving.effects).toHaveLength(1);
    // The native boundary commits saving.state before synchronously returning the I/O result.
    const completed = reduceCampaign(saving.state, { type: "save-written", saved: true });
    expect(completed).toMatchObject({ state: { value: "title" }, handled: true, effects: [] });
    const firstSaved = structuredClone(completed.state.context.game);
    const secondSaved = structuredClone(second.context.game);
    const reset = reduceCampaign(command(completed.state, "new-game"), { type: "command", command: "accept" });
    expect(reset).toMatchObject({
      state: {
        value: "intro",
        context: {
          game: {
            adventure: { mode: "town", currentPlaceId: "town-square", flags: [] },
            party: { members: [{ id: "player", hp: 20 }], slots: ["player", null, null, null] },
            inventory: { balance: 30, equipment: { assignments: [] }, items: { home: [] } },
          },
          expedition: null,
          carryQuantity: 0,
        },
      },
      handled: true,
      effects: [],
    });
    expect(reset.state.context.game.clock).toBeUndefined();
    expect(reset.state.context.game.party.members[0]).not.toBe(second.context.game.party.members[0]);
    expect(reset.state.context.game.inventory?.items.home).not.toBe(second.context.game.inventory?.items.home);
    first = send(command(command(reset.state, "title"), "load"), { type: "save-read", result: { data: effect.data } });
    expect(first.value).toBe("home");
    expect(first.context.game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    expect(first.context.game.inventory?.equipment.assignments).toEqual([]);
    expect(first.context.game.party.members[0]).not.toBe(second.context.game.party.members[0]);
    expect(second.context.game).toEqual(secondSaved);
    second = command(second, "home");
    expect(second.context.game.inventory?.equipment.assignments).toEqual([
      { characterId: "player", weapon: "weapon-1", armor: null },
    ]);
    expect(firstInitial.context).toEqual(firstBefore);
    expect(secondInitial.context).toEqual(secondBefore);
    expect(completed.state.context.game).toEqual(firstSaved);
  });
  it("開始確認の取消・確定・再確認は現在の画面で決め、保存効果を出さない", () => {
    const initial = createCampaignModel();
    const before = structuredClone(initial.context.game);
    const confirm = command(initial, "new-game");
    expect(projectCampaign(confirm)).toMatchObject({
      title: "新しく始めますか",
      focus: { kind: "command", command: "cancel" },
    });
    const cancelled = send(confirm, { type: "escape" });
    expect(cancelled.value).toBe("title");
    expect(cancelled.context.game).toEqual(before);
    const accepted = reduceCampaign(command(cancelled, "new-game"), { type: "command", command: "accept" });
    expect(accepted.effects).toEqual([]);
    expect(projectCampaign(accepted.state)).toMatchObject({ title: "導入", calendar: "", copy: ["（仮テキスト）"] });
    expect(reduceCampaign(accepted.state, { type: "command", command: "accept" }).handled).toBe(false);
    expect(command(accepted.state, "title").value).toBe("title");
    expect(initial.context.game).toEqual(before);
  });
  it("ホーム・探索先・確認・取消・装備の閲覧は時刻、回復、乱数とゲームを変えない", () => {
    const initial = home();
    const before = structuredClone(initial.context.game);
    const focused = reduceCampaign(initial, { type: "focused", target: { kind: "carry" } });
    expect(focused.handled).toBe(true);
    expect(projectCampaign(focused.state).focus).toEqual({ kind: "carry" });
    expect(focused.state.context.game).toEqual(before);
    let state = command(focused.state, "destinations");
    expect(projectCampaign(state)).toMatchObject({ title: "探索先選択", calendar: "1日目 · 昼" });
    state = send(state, { type: "escape" });
    state = command(state, "equipment");
    expect(projectCampaign(state)).toMatchObject({
      title: "装備",
      members: [{ id: "player", summary: "ロッシ · HP 20/20 · 攻撃力 8" }],
    });
    state = command(state, "home");
    state = command(state, "title");
    expect(projectCampaign(state).title).toBe("タイトルへ戻りますか");
    state = command(state, "cancel");
    expect(state.context.game).toEqual(before);
    state = command(command(state, "title"), "accept");
    expect(state.value).toBe("title");
    expect(state.context.game).toEqual(before);
    expect(reduceCampaign(state, { type: "command", command: "equipment" }).handled).toBe(false);
  });
  it("持込みdraftは所持数内の整数だけ探索へ渡し、不正値でゲームを変えない", () => {
    const initial = home();
    if (!initial.context.game.inventory) throw new Error("inventory");
    const source: CampaignModel = campaignMachine.resolveState({
      value: initial.value,
      context: {
        ...initial.context,
        game: {
          ...initial.context.game,
          inventory: {
            ...initial.context.game.inventory,
            items: { ...initial.context.game.inventory.items, home: [{ itemId: recoveryItemId, quantity: 2 }] },
          },
        },
      },
    });
    const before = structuredClone(source.context.game);
    for (const quantity of [null, -1, 0.5, 3, Number.NaN]) {
      const draft = send(source, { type: "carry-changed", quantity });
      expect(reduceCampaign(draft, { type: "command", command: "destinations" })).toMatchObject({
        state: draft,
        effects: [{ type: "report-carry-validity" }],
      });
      expect(draft.context.game).toEqual(before);
    }
    let state = send(source, { type: "carry-changed", quantity: 2 });
    expect(projectCampaign(state)).toMatchObject({ carry: { quantity: 2, stock: 2 } });
    state = command(command(state, "destinations"), "town");
    const started = reduceCampaign(state, { type: "town", event: { type: "select", placeId: "market" } });
    expect(started.townResult?.accepted).toBe(true);
    expect(started.state.context.carryQuantity).toBe(0);
    expect(started.state.context.game.inventory?.items).toMatchObject({
      home: [],
      exploration: { destination: "town", bag: [{ itemId: recoveryItemId, quantity: 2, origin: "carried" }] },
    });
    expect(started.state.context.game.clock).toMatchObject({ elapsedHalfDays: 0, recoverySteps: 0 });
    expect(source.context.game).toEqual(before);
  });
  it("装備変更を実コアで確定し、上限低下だけHPを減らす", () => {
    let state = command(home(), "equipment");
    const original = structuredClone(state.context.game);
    const armor = state.context.game.inventory?.equipment.owned.find(
      ({ definitionId }) => definitionId === "trial-armor",
    )?.instanceId;
    const weapon = state.context.game.inventory?.equipment.owned.find(
      ({ definitionId }) => definitionId === "trial-weapon",
    )?.instanceId;
    if (!armor || !weapon) throw new Error("equipment");
    state = send(state, { type: "equip", characterId: "player", slot: "armor", instanceId: armor });
    expect(projectCampaign(state)).toMatchObject({ members: [{ summary: "ロッシ · HP 20/24 · 攻撃力 8" }] });
    state = campaignMachine.resolveState({
      value: state.value,
      context: {
        ...state.context,
        game: {
          ...state.context.game,
          party: { ...state.context.game.party, members: [{ ...state.context.game.party.members[0], hp: 24 }] },
        },
      },
    });
    state = send(state, { type: "equip", characterId: "player", slot: "armor", instanceId: null });
    expect(state.context.game.party.members[0].hp).toBe(20);
    state = send(state, { type: "equip", characterId: "player", slot: "weapon", instanceId: weapon });
    expect(projectCampaign(state)).toMatchObject({ members: [{ summary: "ロッシ · HP 20/20 · 攻撃力 9" }] });
    const beforeReject = structuredClone(state.context.game);
    state = send(state, { type: "equip", characterId: "missing", slot: "weapon", instanceId: weapon });
    expect(state.context.game).toEqual(beforeReject);
    expect(state.context.message).toBe("装備を変更できませんでした。");
    expect(original.party.members[0].hp).toBe(20);
  });
  it("編成childはdraftだけを持ち、確定gameと帰り先focusを本編が所有する", () => {
    let state = command(home(), "edit-party");
    expect(state.value).toBe("party");
    if (state.value !== "party") throw new Error("party");
    const before = structuredClone(state.context.game);
    state = send(state, { type: "party", event: { type: "open-selection", slot: 0 } });
    state = send(state, { type: "party", event: { type: "toggle", characterId: "player" } });
    expect(state.context.game).toEqual(before);
    state = send(state, { type: "party", event: { type: "confirm" } });
    expect(state.context.game.party.slots).toEqual([null, null, null, null]);
    expect(before.party.slots).toEqual(["player", null, null, null]);
    state = send(state, { type: "party", event: { type: "back" } });
    expect(state).toMatchObject({
      value: "home",
      context: {
        focus: { kind: "command", command: "edit-party" },
      },
    });
    state = command(command(state, "destinations"), "prepare-departure");
    state = send(state, { type: "party", event: { type: "back" } });
    expect(state).toMatchObject({
      value: "destinations",
      context: {
        focus: { kind: "command", command: "prepare-departure" },
      },
    });
  });
  it("編成の同focus通知はsnapshotを保ち、同期commit後の異focusと往復を受理する", () => {
    let state = command(command(home(), "destinations"), "prepare-departure");
    const other = command(home(), "edit-party");
    const otherBefore = structuredClone(other.context);
    const game = state.context.game;
    const notify = (target: PartyFocus) => {
      const previous = state;
      const changed = reduceCampaign(state, { type: "party", event: { type: "focused", target } });
      state = changed.state; // Commit before a native focus callback can synchronously reenter.
      expect(changed.handled).toBe(true);
      expect(changed.effects).toEqual([]);
      expect(state.context.game).toBe(game);
      expect(state.context.party?.party.focus).toEqual(target);
      const repeated = reduceCampaign(state, { type: "party", event: { type: "focused", target: { ...target } } });
      expect(repeated.state).toBe(state);
      expect(repeated).toMatchObject({ handled: true, effects: [] });
      return previous;
    };
    const initial = state;
    notify({ kind: "back" });
    expect(state).toBe(initial);
    for (const target of [
      { kind: "slot", slot: 0 },
      { kind: "slot", slot: 1 },
      { kind: "slot", slot: 0 },
      { kind: "depart" },
      { kind: "back" },
    ] as const)
      expect(notify(target)).not.toBe(state);
    state = send(state, { type: "party", event: { type: "open-selection", slot: 2 } });
    state = send(state, { type: "party", event: { type: "toggle", characterId: "player" } });
    const draft = state.context.party?.party.panel;
    for (const target of [
      { kind: "candidate", characterId: "player" },
      { kind: "candidate", characterId: "gilberta" },
      { kind: "detail", characterId: "gilberta" },
      { kind: "detail", characterId: "player" },
      { kind: "candidate", characterId: "player" },
      { kind: "confirm" },
    ] as const) {
      notify(target);
      expect(state.context.party?.party.panel).toBe(draft);
    }
    expect(other.context).toEqual(otherBefore);
    expect(reduceCampaign(other, { type: "party", event: { type: "focused", target: { kind: "back" } } }).state).toBe(
      other,
    );
    const departed = command(command(home(), "destinations"), "prepare-departure");
    expect(departed.context.party?.context).toBe("departure");
    expect(departed.context.party?.party.focus).toEqual({ kind: "back" });
    expect(departed.context.party?.party.panel).toEqual({ kind: "formation" });
    expect(departed.context.party?.party).not.toBe(initial.context.party?.party);
  });
  it("詳細中は同focusも拒否し、keyboardとopener・選択scroll復元を保持する", () => {
    let state = command(home(), "edit-party");
    const party = (event: PartyEvent) => {
      const changed = reduceCampaign(state, { type: "party", event });
      state = changed.state;
      return changed;
    };
    party({ type: "open-selection", slot: 3 });
    party({ type: "selection-scrolled", scrollTop: 147 });
    party({ type: "focused", target: { kind: "detail", characterId: "player" } });
    party({ type: "show-details", characterId: "player" });
    const game = state.context.game;
    expect(party({ type: "focused", target: { kind: "detail", characterId: "player" } }).handled).toBe(false);
    expect(state.context.party?.party.details.dialog?.id).toBe("player");
    party({ type: "key", key: "Tab", shift: false });
    expect(state.context.party?.party.details.focus).toEqual({ kind: "information" });
    party({ type: "key", key: "Escape", shift: false });
    expect(state.context.party?.party.details.dialog).toBeNull();
    expect(state.context.party?.party.focus).toEqual({ kind: "detail", characterId: "player" });
    expect(state.context.party?.party.panel).toMatchObject({ kind: "selection", openerSlot: 3, scrollTop: 147 });
    const restored = state;
    party({ type: "focused", target: { kind: "detail", characterId: "player" } });
    expect(state).toBe(restored);
    party({ type: "key", key: "Escape", shift: false });
    expect(state.context.party?.party.focus).toEqual({ kind: "slot", slot: 3 });
    party({ type: "key", key: "Tab", shift: false });
    expect(state.context.party?.party.focus).toEqual({ kind: "back" });
    party({ type: "key", key: "Tab", shift: true });
    expect(state.context.party?.party.focus).toEqual({ kind: "slot", slot: 3 });
    expect(state.context.game).toEqual(game);
    party({ type: "back" });
    expect(state.value).toBe("home");
    expect(state.context.party).toBeNull();
    const homeState = state;
    expect(party({ type: "focused", target: { kind: "back" } })).toMatchObject({ handled: false, effects: [] });
    expect(state).toBe(homeState);
    state = send(state, { type: "disposed" });
    const disposed = state;
    expect(party({ type: "focused", target: { kind: "back" } }).handled).toBe(false);
    expect(state).toBe(disposed);
  });
  it("街の同target focusはshop focusを解除し、入力contextの更新も保持する", () => {
    let state = command(command(home(), "destinations"), "town");
    state = send(state, { type: "town", event: { type: "select", placeId: "market" } });
    state = send(state, { type: "town", event: { type: "shop-open" } });
    const focused = { type: "town", event: { type: "focused", target: { kind: "place", placeId: "market" } } } as const;
    state = send(state, focused);
    state = send(state, { type: "town", event: { type: "shop-focused", target: "quantity" } });
    expect(state.context.town).toMatchObject({
      focus: { kind: "place", placeId: "market" },
      shop: { focus: "quantity" },
    });
    const changed = reduceCampaign(state, focused);
    expect(changed.handled).toBe(true);
    expect(changed.state.context.town).toMatchObject({
      focus: { kind: "place", placeId: "market" },
      inputContext: "control",
      shop: { focus: null },
    });
    state = send(changed.state, { type: "town", event: { type: "input-context", context: "text-entry" } });
    expect(send(state, focused).context.town.inputContext).toBe("control");
  });
  it("出発は編成から実探索へ進み、途中操作と帰還を現在の活動へ適用する", () => {
    let state = command(command(home(), "destinations"), "prepare-departure");
    state = send(state, { type: "party", event: { type: "depart" } });
    expect(state).toMatchObject({
      value: "dungeon",
      context: {
        carryQuantity: 0,
        game: { dungeon: { currentNodeId: "entrance", outcome: "ongoing" }, clock: { elapsedHalfDays: 0 } },
      },
    });
    expect(projectCampaign(state)).toMatchObject({
      kind: "dungeon",
      dungeon: { kind: "route", returnLabel: "ホームへ帰還", status: "現在地: 遺跡の入口" },
    });
    const moved = reduceCampaign(state, { type: "dungeon", event: { type: "enter", nodeId: "missing" } });
    expect(moved.dungeonResult?.accepted).toBe(false);
    expect(moved.state.context.game).toEqual(state.context.game);
    state = send(state, { type: "dungeon", event: { type: "return" } });
    expect(state).toMatchObject({
      value: "home",
      context: {
        game: { dungeon: null, clock: { elapsedHalfDays: 1, recoverySteps: 0 } },
      },
    });
    expect(reduceCampaign(state, { type: "dungeon", event: { type: "return" } }).handled).toBe(false);
    state = command(command(state, "destinations"), "prepare-departure");
    state = send(state, { type: "party", event: { type: "depart" } });
    state = send(state, { type: "dungeon", event: { type: "return" } });
    expect(state.context.game.clock).toMatchObject({ elapsedHalfDays: 2, recoverySteps: 0 });
  });
  it("保存は確定データのI/O効果に分け、失敗はホーム、成功時だけタイトルへ戻る", () => {
    const initial = home();
    const before = structuredClone(initial.context.game);
    let state = command(initial, "save-title");
    const write = reduceCampaign(state, { type: "command", command: "accept" });
    expect(write.state.value).toBe("saving");
    expect(write.state.context.returnToTitle).toBe(true);
    const effect = write.effects[0];
    if (effect?.type !== "write-save") throw new Error("save");
    expect(JSON.parse(effect.data).version).toBe(5);
    expect(deserializeGame(effect.data, saveDefinitions)).toMatchObject({
      accepted: true,
      state: { party: before.party },
    });
    expect(reduceCampaign(write.state, { type: "command", command: "accept" }).handled).toBe(false);
    state = send(write.state, { type: "save-written", saved: false });
    expect(state).toMatchObject({
      value: "home",
      context: {
        game: before,
        message: "保存できませんでした。ブラウザの保存領域を確認してください。",
      },
    });
    state = command(command(state, "save-title"), "accept");
    state = send(state, { type: "save-written", saved: true });
    expect(state).toMatchObject({
      value: "title",
      context: {
        game: before,
        message: "保存しました。",
      },
    });
    state = command(command(initial, "save"), "accept");
    expect(send(state, { type: "save-written", saved: true }).value).toBe("home");
  });
  it.each([
    [{ data: null }, "保存データがありません。"],
    [{ error: true }, "読み込めませんでした。ブラウザの保存領域を確認してください。"],
    [{ data: "broken" }, "保存データを読み込めませんでした。"],
    [{ data: '{"version":1}' }, "対応していない保存データです。"],
  ] as const)("読込失敗は現在gameとタイトルを保持する %#", (value, message) => {
    const initial = createCampaignModel();
    const before = structuredClone(initial.context.game);
    const read = reduceCampaign(initial, { type: "command", command: "load" });
    expect(read.effects).toEqual([{ type: "read-save" }]);
    const state = send(read.state, { type: "save-read", result: value });
    expect(state).toMatchObject({
      value: "title",
      context: {
        game: before,
        message,
      },
    });
    expect(initial.context.game).toEqual(before);
  });
  it("保存再開は状態を復元し、HP・時計・回復・乱数を再実行しない", () => {
    let source = home();
    source = campaignMachine.resolveState({
      value: source.value,
      context: {
        ...source.context,
        game: applyPartyStatus(source.context.game, "player", { kind: "haze", amount: 30 }, saveDefinitions.characters),
      },
    });
    const before = structuredClone(source.context.game);
    const saved = reduceCampaign(command(source, "save"), { type: "command", command: "accept" }).effects[0];
    if (saved?.type !== "write-save") throw new Error("save");
    const loaded = send(command(createCampaignModel(), "load"), { type: "save-read", result: { data: saved.data } });
    expect(loaded).toMatchObject({
      value: "home",
      context: {
        carryQuantity: 0,
        message: "読み込みました。",
        game: { party: before.party, adventure: before.adventure },
      },
    });
    expect(loaded.context.game.party.members[0].status?.haze).toBe(30);
    expect(source.context.game).toEqual(before);
  });
  it("同じ街の次探索を受理し、会話途中は進めず完了ごとに半日と回復を確定する", () => {
    let state = command(command(home(), "destinations"), "town");
    const initial = structuredClone(state.context.game);
    for (let visit = 1; visit <= 2; visit++) {
      state = send(state, { type: "town", event: { type: "select", placeId: "market" } });
      expect(state.context.game.clock).toMatchObject({ elapsedHalfDays: visit - 1, recoverySteps: visit - 1 });
      expect(reduceCampaign(state, { type: "command", command: "home" }).handled).toBe(false);
      state = send(state, { type: "town", event: { type: "advance" } });
      expect(state.context.game.clock).toMatchObject({ elapsedHalfDays: visit, recoverySteps: visit });
      expect(state.context.focus).toEqual({ kind: "town-place", placeId: "market" });
      const ended = reduceCampaign(state, { type: "town", event: { type: "advance" } });
      expect(ended.townResult?.accepted).toBe(false);
      expect(ended.state.context.game).toEqual(state.context.game);
    }
    expect(command(state, "home").value).toBe("home");
    expect(initial.party.members[0].hp).toBe(20);
  });
  it("街XPで成立した習得を必須画面で確定し、候補・乱数を保持して元の街のfocusへ戻る", () => {
    const source = home();
    const rewarded = rewardGrowth(
      source.context.game,
      { allocations: [{ characterId: "player", experience: 5 }] },
      campaignRules,
    );
    if (!rewarded.accepted) throw new Error(rewarded.reason);
    let state = command(
      command(
        campaignMachine.resolveState({
          value: source.value,
          context: {
            ...source.context,
            game: rewarded.state,
          },
        }),
        "destinations",
      ),
      "town",
    );
    state = send(state, { type: "town", event: { type: "select", placeId: "market" } });
    state = send(state, { type: "town", event: { type: "advance" } });
    expect(state).toMatchObject({
      value: "growth",
      context: {
        game: {
          clock: { elapsedHalfDays: 1, recoverySteps: 1 },
          growth: { choice: { characterId: "player", level: 2, status: "offered" } },
        },
      },
    });
    const before = structuredClone(state.context.game);
    const choice = state.context.game.growth?.choice;
    if (!choice) throw new Error("choice");
    expect(choice.candidateIds).toHaveLength(3);
    state = send(state, { type: "growth", event: { type: "key", key: "Tab", shift: false } });
    expect(state.context.focus).toEqual({ kind: "growth-candidate", skillId: choice.candidateIds[0] });
    state = send(state, { type: "growth", event: { type: "key", key: "Tab", shift: true } });
    expect(state.context.focus).toEqual({ kind: "growth-candidate", skillId: choice.candidateIds[2] });
    state = send(state, { type: "growth", event: { type: "focused", target: { kind: "heading" } } });
    expect(state.context.focus).toEqual({ kind: "growth-heading" });
    expect(reduceCampaign(state, { type: "growth", event: { type: "key", key: "Space", shift: false } }).handled).toBe(
      false,
    );
    expect(projectCampaign(state)).toMatchObject({ growth: { title: "ロッシ · Lv2 スキル選択" } });
    expect(state.context.game).toEqual(before);
    const rejected = send(state, { type: "growth", event: { type: "choose", skillId: "missing" } });
    expect(rejected.context.game).toEqual(before);
    expect(rejected.value).toBe("growth");
    const selected = choice.candidateIds[0];
    state = send(rejected, { type: "growth", event: { type: "choose", skillId: selected } });
    expect(state).toMatchObject({
      value: "town",
      context: {
        focus: { kind: "town-place", placeId: "market" },
        game: { clock: { elapsedHalfDays: 1, recoverySteps: 1 }, growth: { choice: null } },
      },
    });
    expect(
      state.context.game.growth?.characters.find(({ characterId }) => characterId === "player")?.learned,
    ).toContainEqual(expect.objectContaining({ skillId: selected, acquisition: "choice" }));
    expect(state.context.game.randomState).toBe(before.randomState);
    expect(
      state.context.game.growth?.growth.characters.find(({ characterId }) => characterId === "player"),
    ).toMatchObject({
      level: 2,
      experience: 0,
      pendingChoiceLevels: [],
    });
    expect(reduceCampaign(state, { type: "growth", event: { type: "choose", skillId: selected } }).handled).toBe(false);
    expect(rewarded.state.clock?.elapsedHalfDays ?? 0).toBe(0);
  });
  it("各画面に未定義の操作はゲームを変えず、戻った現在画面の操作は再び有効になる", () => {
    const initial = createCampaignModel();
    for (const [state, expectedAccept] of [
      [initial, false],
      [command(initial, "new-game"), true],
      [command(command(initial, "new-game"), "accept"), false],
      [home(), false],
      [command(home(), "equipment"), false],
      [command(home(), "destinations"), false],
    ] as const) {
      const before = structuredClone(state.context.game);
      expect(reduceCampaign(state, { type: "command", command: "accept" }).handled).toBe(expectedAccept);
      expect(reduceCampaign(state, { type: "town", event: { type: "advance" } })).toMatchObject({
        handled: false,
        state,
      });
      if (state.value !== "confirm" && state.value !== "destinations")
        expect(reduceCampaign(state, { type: "escape" })).toMatchObject({ handled: false, state });
      expect(state.context.game).toEqual(before);
    }
    const destinations = command(home(), "destinations");
    const returned = command(destinations, "home");
    expect(command(returned, "destinations").value).toBe("destinations");
    const townState = command(destinations, "town");
    expect(command(townState, "home").value).toBe("home");
    expect(send(townState, { type: "town", event: { type: "home" } }).value).toBe("home");
    const party = command(returned, "edit-party");
    const projected = projectCampaign(party);
    expect(projected).toMatchObject({ kind: "party", title: "編成" });
    if (projected.kind !== "party") throw new Error("party");
    expect(projected.party.slots.map(({ member }) => member?.id ?? null)).toEqual(["player", null, null, null]);
  });
  it("破棄後のI/O・入力は現在状態で未定義になり、ゲームを変えない", () => {
    const state = send(home(), { type: "disposed" });
    expect(projectCampaign(state).kind).toBe("disposed");
    for (const event of [
      { type: "save-written", saved: true },
      { type: "save-read", result: { data: null } },
      { type: "command", command: "destinations" },
      { type: "focused", target: { kind: "heading" } },
    ] as const)
      expect(reduceCampaign(state, event)).toMatchObject({ state, handled: false, effects: [] });
  });
  it("実探索の読込中に退出すると資源終了を発行し、遅着結果でゲームや画面を再開しない", () => {
    let state = command(command(home(), "destinations"), "prepare-departure");
    state = send(state, { type: "party", event: { type: "depart" } });
    const started = reduceCampaign(state, { type: "dungeon", event: { type: "enter", nodeId: "battle-a" } });
    expect(started.effects).toEqual([{ type: "dungeon", effect: { type: "open-scene", owner: 1 } }]);
    const before = structuredClone(started.state.context.game);
    const closed = reduceCampaign(started.state, { type: "disposed" });
    expect(closed.effects).toEqual([{ type: "dungeon", effect: { type: "close-scene" } }]);
    expect(projectCampaign(closed.state).kind).toBe("disposed");
    for (const event of [
      { type: "scene-ready", owner: 1 },
      { type: "scene-error", owner: 1, reason: "退出後に素材取得が終了" },
    ] as const) {
      const late = reduceCampaign(closed.state, { type: "dungeon", event: { type: "battle", event } });
      expect(late.handled).toBe(false);
      expect(late.state.context.game).toEqual(before);
      expect(late.effects).toEqual([]);
    }
  });
});
