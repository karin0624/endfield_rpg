import { describe, expect, it } from "vitest";
import { initialBattleCombatants } from "../content/initialBattle";
import {
  createDebugBattleModel,
  type DebugBattleInput,
  projectDebugBattle,
  reduceDebugBattle,
} from "./debugBattleModel";

const input: DebugBattleInput = {
  combatants: initialBattleCombatants,
  enemyDepths: [
    { id: "slime", depth: 10 },
    { id: "slime-2", depth: 5 },
  ],
  editor: true,
};

describe("固定戦闘デモの同期状態遷移", () => {
  it("実コアの4行動を確定して勝利し、表示終了後に再戦して新しいsceneを所有する", () => {
    let state = createDebugBattleModel(input);
    const original = state;
    const untouched = structuredClone(state);
    expect(projectDebugBattle(state, input).view).toBeNull();
    state = reduceDebugBattle(state, input, { type: "scene-ready", owner: 0 }).state;
    for (const [target, hp] of [
      ["slime-2", 6],
      ["slime-2", 0],
      ["slime", 6],
      ["slime", 0],
    ] as const) {
      const next = reduceDebugBattle(state, input, { type: "attack" });
      expect(next.state.battle.combatants.find(({ id }) => id === target)?.hp).toBe(hp);
      expect(next.effects).toEqual([]);
      state = next.state;
      expect(reduceDebugBattle(state, input, { type: "attack" }).handled).toBe(false);
      state = reduceDebugBattle(state, input, { type: "playback", event: { type: "advance", elapsedMs: 3000 } }).state;
    }
    expect(state.battle.outcome).toBe("victory");
    expect(state.battle.combatants.find(({ id }) => id === "player")?.hp).toBe(16);
    expect(projectDebugBattle(state, input).view?.result).toMatchObject({ visible: true, title: "戦闘に勝利しました" });
    const rematch = reduceDebugBattle(state, input, { type: "finish" });
    expect(rematch.effects).toEqual([{ type: "replace-scene", owner: 1 }]);
    expect(rematch.state.battle.combatants.map(({ hp }) => hp)).toEqual([20, 18, 14, 14]);
    expect(reduceDebugBattle(rematch.state, input, { type: "scene-ready", owner: 0 }).handled).toBe(false);
    state = reduceDebugBattle(rematch.state, input, { type: "scene-ready", owner: 1 }).state;
    expect(reduceDebugBattle(state, input, { type: "attack" }).handled).toBe(true);
    expect(original).toEqual(untouched);
  });

  it("親のリンクと戦闘内のfocusを意味順に移し、アプリ外のTabはnativeへ返す", () => {
    let state = reduceDebugBattle(createDebugBattleModel(input), input, { type: "scene-ready", owner: 0 }).state;
    state = reduceDebugBattle(state, input, { type: "focused", target: { kind: "attack" } }).state;
    state = reduceDebugBattle(state, input, { type: "key", key: "Tab", shift: false }).state;
    expect(projectDebugBattle(state, input).utilityFocus).toBe("town");
    state = reduceDebugBattle(state, input, { type: "key", key: "Tab", shift: false }).state;
    expect(projectDebugBattle(state, input).utilityFocus).toBe("editor");
    const outside = reduceDebugBattle(state, input, { type: "key", key: "Tab", shift: false });
    expect(outside.handled).toBe(false);
    expect(projectDebugBattle(outside.state, input).utilityFocus).toBeNull();
    state = reduceDebugBattle(outside.state, input, { type: "utility-focused", target: "town" }).state;
    state = reduceDebugBattle(state, input, { type: "key", key: "Tab", shift: true }).state;
    expect(projectDebugBattle(state, input).view?.focus).toEqual({ kind: "attack" });
    state = reduceDebugBattle(state, input, { type: "focused", target: { kind: "enemy", id: "slime" } }).state;
    expect(reduceDebugBattle(state, input, { type: "key", key: "Tab", shift: true }).handled).toBe(false);
  });

  it("scene失敗は理由を保持し、退出後のready/error/操作で資源やゲームを再開しない", () => {
    let state = createDebugBattleModel(input);
    state = reduceDebugBattle(state, input, { type: "scene-error", owner: 0, reason: "portrait 404" }).state;
    expect(projectDebugBattle(state, input)).toMatchObject({ view: null, animate: false, status: { error: true } });
    expect(state.view.scene.reason).toBe("portrait 404");
    const closed = reduceDebugBattle(state, input, { type: "closed" });
    expect(closed.effects).toEqual([{ type: "close-scene" }]);
    for (const event of [
      { type: "scene-ready", owner: 0 },
      { type: "scene-error", owner: 0, reason: "late" },
      { type: "attack" },
      { type: "closed" },
      { type: "utility-focused", target: "town" },
      { type: "key", key: "Tab", shift: false },
    ] as const)
      expect(reduceDebugBattle(closed.state, input, event)).toMatchObject({
        state: closed.state,
        effects: [],
        handled: false,
      });
  });
});
