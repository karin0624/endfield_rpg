import { describe, expect, it } from "vitest";
import { rewardGrowth } from "../game/growthRuntime";
import { createInventory } from "../game/inventory";
import {
  createDebugSessionModel,
  type DebugSessionEvent,
  type DebugSessionModel,
  debugSessionRules,
  reduceDebugSession,
} from "./debugSessionModel";
import { projectDebugSession } from "./debugSessionProjection";

const send = (state: DebugSessionModel, event: DebugSessionEvent) => reduceDebugSession(state, event).state;
const town = (state: DebugSessionModel, event: Extract<DebugSessionEvent, { type: "town" }>["event"]) =>
  send(state, { type: "town", event });

describe("debug入口の現在セッション", () => {
  it("通常入口と同じ実コアで生活時刻を進め、debug市場の買物能力は増やさない", () => {
    const source = createDebugSessionModel("town", true);
    const before = structuredClone(source.game);
    const frame = projectDebugSession(source);
    expect(frame).toMatchObject({
      kind: "town",
      town: {
        adventure: { calendar: "1日目 · 昼", utilities: { party: true, debug: true, home: false, editor: true } },
        shop: { visible: false },
      },
    });
    let state = town(
      { ...source, game: { ...source.game, inventory: createInventory() } },
      { type: "select", placeId: "market" },
    );
    expect(projectDebugSession(state)).toMatchObject({ town: { shop: { visible: false } } });
    expect(reduceDebugSession(state, { type: "town", event: { type: "shop-open" } }).handled).toBe(false);
    expect(reduceDebugSession(state, { type: "town", event: { type: "save" } }).effects).toEqual([]);
    state = town(state, { type: "advance" });
    expect(state.game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    expect(state.town.focus).toEqual({ kind: "place", placeId: "market" });
    expect(source.game).toEqual(before);
  });

  it("編成からの出発・途中帰還を現在活動へ適用し、次の出発を受理する", () => {
    let state = town(createDebugSessionModel("town"), { type: "open-party" });
    expect(reduceDebugSession(state, { type: "town", event: { type: "save" } }).effects).toEqual([]);
    state = town(state, { type: "party", event: { type: "depart" } });
    expect(state).toMatchObject({
      screen: "dungeon",
      game: { dungeon: { currentNodeId: "entrance" }, clock: { elapsedHalfDays: 0 } },
    });
    const refused = reduceDebugSession(state, { type: "dungeon", command: { type: "enter", nodeId: "missing" } });
    expect(refused.dungeonResult?.accepted).toBe(false);
    expect(refused.state.game).toEqual(state.game);
    state = send(state, { type: "return" });
    expect(state).toMatchObject({
      screen: "town",
      game: { dungeon: null, clock: { elapsedHalfDays: 1, recoverySteps: 0 } },
    });
    state = town(state, { type: "open-party" });
    state = town(state, { type: "party", event: { type: "depart" } });
    expect(state.screen).toBe("dungeon");
    expect(send(state, { type: "return" }).game.clock?.elapsedHalfDays).toBe(2);
    expect(projectDebugSession(createDebugSessionModel("dungeon")).kind).toBe("dungeon");
  });

  it("保存・復元を純粋確定データとI/O結果へ分け、読込成功時に旧native画面ownerを交換する", () => {
    const source = createDebugSessionModel("town");
    const before = structuredClone(source.game);
    const save = reduceDebugSession(source, { type: "town", event: { type: "save" } });
    const effect = save.effects[0];
    if (effect?.type !== "write-save") throw new Error("write-save");
    expect(save.state.screen).toBe("saving");
    expect(send(save.state, { type: "save-written", saved: false }).saveStatus).toContain("保存できませんでした");
    const saved = send(save.state, { type: "save-written", saved: true });
    expect(saved).toMatchObject({ screen: "town", saveStatus: "保存しました。", game: before });
    const read = reduceDebugSession(saved, { type: "town", event: { type: "load" } });
    expect(read.effects).toEqual([{ type: "read-save" }]);
    const loaded = reduceDebugSession(read.state, { type: "save-read", result: { data: effect.data } });
    expect(loaded.effects).toEqual([{ type: "replace-town-view" }]);
    expect(loaded.state).toMatchObject({
      screen: "town",
      saveStatus: "読み込みました。",
      game: { party: before.party, adventure: before.adventure },
    });
    expect(loaded.state.game.clock).toMatchObject({ elapsedHalfDays: 0, recoverySteps: 0 });
    expect(loaded.state.game.randomState).toBe(1);
    expect(source.game).toEqual(before);
  });

  it.each([
    [{ data: null }, "保存データがありません。"],
    [{ error: true }, "読み込めませんでした。ブラウザの保存領域を確認してください。"],
    [{ data: "broken" }, "保存データを読み込めませんでした。"],
    [{ data: '{"version":1}' }, "対応していない保存データです。"],
  ] as const)("読込失敗は元ゲームと現在画面ownerを保持する %#", (result, message) => {
    const source = createDebugSessionModel("town");
    const before = structuredClone(source.game);
    const read = town(source, { type: "load" });
    const ended = reduceDebugSession(read, { type: "save-read", result });
    expect(ended.state).toMatchObject({ screen: "town", game: before, saveStatus: message });
    expect(ended.effects).toEqual([]);
    expect(source.game).toEqual(before);
  });

  it("街完了の必須習得とfocusを実コアで確定し、成長画面のキーはゲームを進めない", () => {
    const source = createDebugSessionModel("town");
    const rewarded = rewardGrowth(
      source.game,
      { id: "before-town", allocations: [{ characterId: "player", experience: 5 }] },
      debugSessionRules,
    );
    if (!rewarded.accepted) throw new Error(rewarded.reason);
    let state = town({ ...source, game: rewarded.state }, { type: "select", placeId: "market" });
    state = town(state, { type: "advance" });
    expect(state).toMatchObject({
      screen: "growth",
      growthFocus: { kind: "heading" },
      game: { clock: { elapsedHalfDays: 1, recoverySteps: 1 } },
    });
    expect(projectDebugSession(state)).toMatchObject({ kind: "growth", growth: { title: "ロッシ · Lv2 スキル選択" } });
    const before = structuredClone(state.game);
    const candidates = state.game.growth?.choice?.candidateIds;
    if (!candidates) throw new Error("choice");
    state = send(state, { type: "growth", event: { type: "key", key: "Tab", shift: false } });
    expect(state.growthFocus).toEqual({ kind: "candidate", skillId: candidates[0] });
    state = send(state, { type: "growth", event: { type: "key", key: "Tab", shift: true } });
    expect(state.growthFocus).toEqual({ kind: "candidate", skillId: candidates[2] });
    state = send(state, { type: "growth", event: { type: "focused", target: { kind: "heading" } } });
    state = send(state, { type: "growth", event: { type: "key", key: "Tab", shift: true } });
    expect(state.growthFocus).toEqual({ kind: "candidate", skillId: candidates[2] });
    expect(state.game).toEqual(before);
    expect(
      reduceDebugSession(state, { type: "growth", event: { type: "key", key: "Space", shift: false } }).handled,
    ).toBe(false);
    expect(
      reduceDebugSession(state, {
        type: "growth",
        event: { type: "focused", target: { kind: "candidate", skillId: "missing" } },
      }).handled,
    ).toBe(false);
    expect(
      reduceDebugSession(state, { type: "growth", event: { type: "choose", skillId: "missing" } }).state.game,
    ).toEqual(before);
    state = send(state, { type: "growth", event: { type: "choose", skillId: candidates[0] } });
    expect(state).toMatchObject({
      screen: "town",
      town: { focus: { kind: "place", placeId: "market" } },
      game: { growth: { choice: null }, clock: { elapsedHalfDays: 1, recoverySteps: 1 } },
    });
  });

  it("破棄後の非同期I/O結果と画面外イベントはゲームを変えない", () => {
    const source = createDebugSessionModel("town");
    expect(reduceDebugSession(source, { type: "command", command: "new-game" }).handled).toBe(false);
    const disposed = send(source, { type: "disposed" });
    expect(projectDebugSession(disposed).kind).toBe("disposed");
    for (const event of [
      { type: "save-written", saved: true },
      { type: "town", event: { type: "select", placeId: "market" } },
      { type: "return" },
    ] as const)
      expect(reduceDebugSession(disposed, event)).toMatchObject({ handled: false, state: disposed, effects: [] });
  });
});
