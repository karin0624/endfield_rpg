import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { itemCatalog, recoveryItemId } from "../content/itemSettings";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import type { DungeonDefinition } from "../game/dungeon";
import { departOnExpedition } from "../game/expedition";
import { createInventory } from "../game/inventory";
import { bagItemQuantity, createItemState } from "../game/items";
import { createParty } from "../game/party";
import { healthyStatus } from "../game/status";
import { createDungeonModel, type DungeonEvent, type DungeonInput, reduceDungeon } from "./dungeonModel";
import { projectDungeon } from "./dungeonProjection";
import { projectRouteEdge, projectRouteLayout } from "./dungeonRoute";

const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition };
const directBoss: DungeonDefinition = {
  id: "direct-boss",
  entryNodeId: "entrance",
  nodes: [
    { id: "entrance", type: "start", label: "入口", nextNodeIds: ["boss"] },
    {
      id: "boss",
      type: "boss",
      label: "守り手",
      nextNodeIds: [],
      enemies: [{ id: "enemy", team: "enemy", hp: 28, speed: 85, attackPower: 5 }],
    },
  ],
};
function initial(hp = 20, route: DungeonDefinition = initialDungeon, growth = false): DungeonInput {
  const inventory = {
    ...createInventory(),
    items: createItemState([{ itemId: recoveryItemId, quantity: 2 }], itemCatalog),
  };
  const party = createParty(characters, ["player"]);
  const coreRules = growth ? { ...rules, growth: growthRules } : rules;
  const departed = departOnExpedition(
    {
      adventure: createInitialGameState(initialGameOptions),
      party: { ...party, members: party.members.map((member) => ({ ...member, hp })) },
      dungeon: null,
      inventory,
    },
    characters,
    route,
    initialAdventure,
    coreRules,
    [{ itemId: recoveryItemId, quantity: 2 }],
  );
  if (!departed.accepted) throw new Error(departed.reason);
  return {
    game: departed.state,
    route,
    adventure: initialAdventure,
    rules: coreRules,
    basicAttack: true,
    items: true,
    enemyDepths: [
      { id: "enemy", depth: 3 },
      { id: "slime", depth: 3 },
      { id: "slime-2", depth: 4 },
    ],
  };
}
function session(input: DungeonInput) {
  let current = input,
    state = createDungeonModel(input);
  return {
    get input() {
      return current;
    },
    get state() {
      return state;
    },
    send(event: DungeonEvent) {
      const changed = reduceDungeon(state, current, event);
      state = changed.state;
      current = { ...current, game: changed.game };
      return changed;
    },
  };
}

describe("探索画面の同期意味入力", () => {
  it("同じ戦闘命令を再生終了後の現在状態へ受理し、HP/RNGを演出から再計算しない", () => {
    const input = initial(20, directBoss),
      unchanged = structuredClone(input.game),
      app = session(input);
    expect(app.send({ type: "motion", reduced: true }).handled).toBe(true);
    expect(app.send({ type: "enter", nodeId: "boss" }).effects).toEqual([{ type: "open-scene", owner: 1 }]);
    expect(app.state.screen).toMatchObject({ kind: "battle", battle: { playback: { reducedMotion: true } } });
    app.send({ type: "battle", event: { type: "playback", event: { type: "advance", elapsedMs: 5000 } } });
    expect(app.send({ type: "battle", event: { type: "scene-ready", owner: 1 } }).handled).toBe(true);
    for (const [enemyHp, hp, outcome] of [
      [20, 15, "ongoing"],
      [12, 10, "ongoing"],
      [4, 5, "ongoing"],
      [0, 5, "cleared"],
    ] as const) {
      const used = app.send({ type: "battle", event: { type: "attack" } });
      expect(used.result).toMatchObject({
        accepted: true,
        battleState: {
          combatants: [
            { id: "player", hp },
            { id: "enemy", hp: enemyHp },
          ],
        },
      });
      expect(app.input.game.dungeon?.outcome).toBe(outcome);
      expect(app.input.game.party.members.find(({ id }) => id === "player")?.hp).toBe(hp);
      expect(app.send({ type: "battle", event: { type: "attack" } }).handled).toBe(false);
      const committed = structuredClone(app.input.game);
      app.send({ type: "battle", event: { type: "playback", event: { type: "skip" } } });
      expect(app.input.game).toEqual(committed);
    }
    expect(app.send({ type: "battle", event: { type: "finish" } }).effects).toEqual([{ type: "close-scene" }]);
    expect(app.state.screen).toEqual({ kind: "outcome", outcome: "cleared" });
    expect(projectDungeon(app.state, app.input)).toMatchObject({
      kind: "outcome",
      outcome: { title: "探索を完了しました", detail: "遺跡の守り手を倒し、探索を終えました。" },
      status: "探索を完了しました",
    });
    app.send({ type: "focused", target: { kind: "return" } });
    expect(projectDungeon(app.state, app.input).focus).toEqual({ kind: "return" });
    expect(app.send({ type: "return" }).returnRequested).toBe(true);
    expect(input.game).toEqual(unchanged);
    expect(app.input.game.clock).toMatchObject({
      elapsedHalfDays: 0,
      recoverySteps: 0,
      pendingAction: { kind: "dungeon-expedition" },
    });
  });

  it("敗北の半日/帰還は先に確定し、不能表示と旧資源は演出終了まで保持する", () => {
    const app = session(initial(1, directBoss, true));
    app.send({ type: "enter", nodeId: "boss" });
    app.send({ type: "battle", event: { type: "scene-ready", owner: 1 } });
    const failed = app.send({ type: "battle", event: { type: "attack" } });
    expect(failed.completion).toMatchObject({ outcome: "failed", calendarHalfDays: 1 });
    expect(app.input.game.dungeon).toBeNull();
    expect(app.input.game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0, pendingAction: null });
    expect(app.input.game.party.members.find(({ id }) => id === "player")).toMatchObject({
      hp: 20,
      status: { incapacityRecoverySteps: 6 },
    });
    expect(app.state.screen).toMatchObject({
      kind: "battle",
      battle: {
        scene: { status: "ready", owner: 1 },
        playback: {
          record: { after: { outcome: "defeat" } },
          display: {
            combatants: [
              { id: "player", hp: 1 },
              { id: "enemy", hp: 28 },
            ],
          },
        },
      },
    });
    expect(projectDungeon(app.state, app.input)).toMatchObject({
      kind: "battle",
      battle: { view: { allies: [{ id: "player", hp: "1" }], attack: { enabled: false } } },
    });
    expect(app.send({ type: "battle", event: { type: "finish" } }).handled).toBe(false);
    app.send({ type: "battle", event: { type: "playback", event: { type: "skip" } } });
    expect(projectDungeon(app.state, app.input)).toMatchObject({
      battle: { view: { allies: [{ id: "player", hp: "0", defeated: true }] } },
    });
    const returned = structuredClone(app.input.game);
    const finish = app.send({ type: "battle", event: { type: "finish" } });
    expect(finish.returnRequested).toBe(true);
    expect(finish.effects).toEqual([{ type: "close-scene" }]);
    expect(app.input.game).toEqual(returned);
    expect(app.send({ type: "battle", event: { type: "scene-ready", owner: 1 } }).handled).toBe(false);
  });

  it("会話のSpace/選択キーは現在の段階と入力contextで決まり、必須成長を実コアへ渡す", () => {
    const app = session(initial(20, initialDungeon, true));
    expect(projectDungeon(app.state, app.input)).toMatchObject({
      kind: "route",
      calendar: "1日目 · 昼",
      status: "現在地: 遺跡の入口",
      route: {
        nodes: [
          { id: "battle-a", title: "戦闘", enabled: true, current: false },
          { id: "conversation-b", title: "思わぬ遭遇", enabled: true, current: false },
          { id: "boss-c", title: "ボス", enabled: false, current: false },
        ],
      },
    });
    app.send({ type: "enter", nodeId: "conversation-b" });
    expect(projectDungeon(app.state, app.input)).toMatchObject({
      kind: "conversation",
      conversation: {
        scene: { type: "line", speaker: "ロッシ", text: "道の脇に、遺跡へ続く新しい足跡が残っている。" },
      },
    });
    expect(app.send({ type: "return" }).handled).toBe(false);
    app.send({ type: "input-context", context: "text-entry" });
    expect(app.send({ type: "input-context", context: "text-entry" }).handled).toBe(false);
    expect(app.send({ type: "key", key: " ", code: "Space", shift: false }).handled).toBe(false);
    app.send({ type: "input-context", context: "screen" });
    expect(app.send({ type: "key", key: " ", code: "Space", shift: false }).handled).toBe(true);
    expect(app.send({ type: "advance" }).handled).toBe(false);
    expect(app.send({ type: "focused", target: { kind: "choice", id: "mark-on-map" } }).handled).toBe(true);
    expect(app.state.focus).toEqual({ kind: "choice", id: "mark-on-map" });
    expect(app.send({ type: "key", key: "1", code: "Digit1", shift: false }).handled).toBe(true);
    expect([...(app.input.game.dungeon?.flags ?? [])].sort()).toEqual(["marked-ruins-route", "scouted-ruins"].sort());
    expect(app.state.screen.kind).toBe("growth");
    expect(projectDungeon(app.state, app.input).growth?.title).toBe("ロッシ · Lv2 スキル選択");
    expect(app.input.game.growth?.choice).toMatchObject({
      level: 2,
      candidateIds: ["test-power", "test-vitality", "test-light-strike"],
    });
    expect(app.input.game.party.members.find(({ id }) => id === "player")?.hp).toBe(24);
    const before = structuredClone(app.input.game);
    expect(app.send({ type: "enter", nodeId: "boss-c" }).handled).toBe(false);
    expect(app.send({ type: "growth", event: { type: "choose", skillId: "not-offered" } }).handled).toBe(false);
    expect(app.input.game).toEqual(before);
    app.send({ type: "growth", event: { type: "key", key: "Tab", shift: true } });
    expect(app.state.growthFocus).toEqual({ kind: "candidate", skillId: "test-light-strike" });
    expect(app.send({ type: "growth", event: { type: "choose", skillId: "test-power" } }).handled).toBe(true);
    expect(app.state.screen.kind).toBe("route");
    expect(app.input.game.growth?.choice).toBeNull();
    expect(app.input.game.clock?.elapsedHalfDays).toBe(0);
    expect(projectDungeon(app.state, app.input)).toMatchObject({
      kind: "route",
      conversation: null,
      growth: null,
      status: "現在地: 足跡の調査",
      route: {
        nodes: [
          { id: "battle-a", title: null, past: true, enabled: false },
          { id: "conversation-b", title: "思わぬ遭遇", current: true, resolved: true },
          { id: "boss-c", title: "ボス", enabled: true },
        ],
      },
    });
  });

  it("分岐の回復dialogを取消/再開し、現在HPと実残数から確定と復帰focusを決める", () => {
    const source = initial(5),
      before = structuredClone(source.game),
      app = session(source);
    app.send({ type: "branch", event: { type: "open-skill" } });
    expect(app.state.branch.focus).toEqual({ kind: "actor", id: "player" });
    expect(projectDungeon(app.state, app.input).branch).toMatchObject({
      title: "使用者を選ぶ",
      panel: "skill",
      buttons: [{ label: "ロッシ", event: { type: "actor", id: "player" } }],
    });
    app.send({ type: "branch", event: { type: "focused", target: { kind: "actor", id: "player" } } });
    app.send({ type: "branch", event: { type: "key", key: "Escape", shift: false } });
    expect(app.state.branch.focus).toEqual({ kind: "skill-trigger" });
    expect(app.send({ type: "branch", event: { type: "open-skill" } }).handled).toBe(true);
    app.send({ type: "branch", event: { type: "actor", id: "player" } });
    expect(app.state.branch.focus).toEqual({ kind: "skill", id: "test-heal" });
    expect(projectDungeon(app.state, app.input).branch).toMatchObject({
      title: "ロッシの技を選ぶ",
      buttons: [{ label: "検証用回復 · 精神疲労 +3" }],
    });
    expect(projectDungeon(app.state, app.input).branch.buttons[0].description).toContain("現在の精神疲労 0");
    app.send({ type: "branch", event: { type: "skill", id: "test-heal" } });
    expect(app.input.game).toEqual(before);
    expect(app.state.branch.focus).toEqual({ kind: "target", id: "player" });
    expect(projectDungeon(app.state, app.input).branch).toMatchObject({
      panel: "skill",
      title: "回復する味方を選ぶ",
      buttons: [{ label: "ロッシ HP 5/20" }],
    });
    app.send({ type: "branch", event: { type: "target", id: "player" } });
    expect(app.input.game.party.members.find(({ id }) => id === "player")).toMatchObject({ hp: 20, mentalFatigue: 3 });
    expect(app.state.branchResult).toBe("HPを15回復。精神疲労 0 → 3。");
    expect(app.state.branch.focus).toEqual({ kind: "skill-trigger" });
    app.send({ type: "key", key: "Tab", code: "Tab", shift: false });
    expect(app.state.focus).toEqual({ kind: "branch", target: { kind: "item-trigger" } });
    app.send({ type: "enter", nodeId: "conversation-b" });
    expect(app.state.branch.focus).toBeNull();
    app.send({ type: "advance" });
    app.send({ type: "choose", optionId: "mark-on-map" });
    app.send({ type: "key", key: "Tab", code: "Tab", shift: false });
    expect(app.state.focus).toEqual({ kind: "return" });
    expect(source.game).toEqual(before);
    const items = session(initial(5));
    for (const [hp, stock] of [
      [13, 1],
      [20, 0],
    ]) {
      items.send({ type: "branch", event: { type: "open-item" } });
      expect(projectDungeon(items.state, items.input).branch).toMatchObject({
        panel: "item",
        targets: [{ id: "player", label: `ロッシ · HP ${hp === 13 ? 5 : 13}/20` }],
        itemPreview: hp === 13 ? "回復見込み +8 HP · 残り2個" : "回復見込み +7 HP · 残り1個",
        itemUsable: true,
      });
      items.send({ type: "branch", event: { type: "key", key: "Tab", shift: true } });
      expect(items.state.branch.focus).toEqual({ kind: "cancel" });
      items.send({ type: "branch", event: { type: "use-item" } });
      expect(items.input.game.party.members.find(({ id }) => id === "player")).toMatchObject({ hp, mentalFatigue: 0 });
      expect(items.input.game.inventory && bagItemQuantity(items.input.game.inventory.items, recoveryItemId)).toBe(
        stock,
      );
    }
    expect(items.state.focus).toEqual({ kind: "node", id: "battle-a" });
    expect(items.state.branch.focus).toBeNull();
    expect(items.send({ type: "branch", event: { type: "open-item" } }).handled).toBe(false);
    expect(items.input.game.clock?.elapsedHalfDays).toBe(0);
    const full = session(initial());
    full.send({ type: "branch", event: { type: "open-item" } });
    expect(projectDungeon(full.state, full.input).branch).toMatchObject({
      itemPreview: "HPは満タンです。使用できません。",
      itemUsable: false,
    });
    const unchanged = structuredClone(full.input.game);
    full.send({ type: "branch", event: { type: "item-target", id: "player" } });
    full.send({ type: "branch", event: { type: "focused", target: { kind: "item-target" } } });
    for (const [shift, focus] of [
      [false, "cancel"],
      [false, "item-target"],
      [true, "cancel"],
    ] as const) {
      full.send({ type: "branch", event: { type: "key", key: "Tab", shift } });
      expect(projectDungeon(full.state, full.input).branch.focus).toEqual({ kind: focus });
    }
    expect(full.send({ type: "branch", event: { type: "use-item" } }).handled).toBe(false);
    full.send({ type: "branch", event: { type: "cancel" } });
    expect(full.state.focus).toEqual({ kind: "branch", target: { kind: "item-trigger" } });
    expect(full.input.game).toEqual(unchanged);
  });

  it("準備失敗/終了後の完了は現在の資源所有と区別し、理由を状態へ渡す", () => {
    const app = session(initial(20, directBoss));
    app.send({ type: "enter", nodeId: "boss" });
    expect(app.send({ type: "battle", event: { type: "scene-error", owner: 0, reason: "旧画像" } }).handled).toBe(
      false,
    );
    expect(
      app.send({ type: "battle", event: { type: "scene-error", owner: 1, reason: "GLB取得失敗" } }).effects,
    ).toEqual([{ type: "close-scene", releaseRenderer: true }]);
    expect(app.state.screen).toMatchObject({
      kind: "battle",
      battle: { scene: { status: "error", reason: "GLB取得失敗" } },
    });
    expect(projectDungeon(app.state, app.input).battle?.status).toMatchObject({
      ready: false,
      error: true,
      reason: "GLB取得失敗",
    });
    expect(app.send({ type: "closed" }).effects).toEqual([{ type: "close-scene" }]);
    const closed = structuredClone(app.state);
    for (const event of [
      { type: "enter", nodeId: "boss" },
      { type: "battle", event: { type: "scene-ready", owner: 1 } },
    ] as const)
      expect(app.send(event).handled).toBe(false);
    expect(app.state).toEqual(closed);
  });

  it("ルート寸法と現在位置から中心/境界を投影し、pointer captureは現在gestureだけに適用する", () => {
    const app = session(initial());
    const measure = {
      viewportWidth: 390,
      responsiveWorldWidth: 928,
      nodes: [
        { id: "battle-a", fraction: 0.34, center: 316, width: 156 },
        { id: "conversation-b", fraction: 0.34, center: 316, width: 156 },
        { id: "boss-c", fraction: 0.74, center: 687, width: 156 },
      ],
    };
    app.send({ type: "route", event: { type: "measured", measure } });
    expect(projectRouteLayout(app.state.route, ["entrance", "battle-a", "conversation-b"])).toEqual({
      width: null,
      offset: -121,
    });
    expect(app.send({ type: "route", event: { type: "pointer-down", pointerId: 4, x: 200, button: 0 } }).handled).toBe(
      true,
    );
    expect(app.send({ type: "route", event: { type: "pointer-move", pointerId: 4, x: 198 } }).handled).toBe(false);
    expect(app.send({ type: "route", event: { type: "pointer-move", pointerId: 4, x: 100 } }).effects).toEqual([
      { type: "capture-pointer", pointerId: 4 },
    ]);
    expect(app.state.route.offset).toBe(-221);
    expect(app.send({ type: "route", event: { type: "pointer-move", pointerId: 4, x: -300 } }).effects).toEqual([]);
    expect(app.state.route.offset).toBe(-492);
    app.send({ type: "route", event: { type: "pointer-end", pointerId: 4 } });
    expect(app.send({ type: "route", event: { type: "pointer-move", pointerId: 4, x: 150 } }).handled).toBe(false);
    app.send({
      type: "route",
      event: {
        type: "measured",
        measure: {
          viewportWidth: 1440,
          responsiveWorldWidth: 1872,
          nodes: [
            { id: "battle-a", fraction: 0.34, center: 636, width: 158 },
            { id: "conversation-b", fraction: 0.34, center: 636, width: 158 },
            { id: "boss-c", fraction: 0.74, center: 1385, width: 158 },
          ],
        },
      },
    });
    expect(app.state.route.offset).toBe(-492);
    expect(app.send({ type: "route", event: { type: "pan-key", key: "ArrowRight" } }).handled).toBe(false);
    app.send({ type: "focused", target: { kind: "route" } });
    for (let press = 0; press < 4; press++) app.send({ type: "route", event: { type: "pan-key", key: "ArrowRight" } });
    expect(app.state.route.offset).toBe(-665);
    app.send({ type: "route", event: { type: "measured", measure } });
    expect(app.state.route.offset).toBe(-492);
    app.send({ type: "route", event: { type: "pan-key", key: "ArrowLeft" } });
    expect(app.state.route.offset).toBe(-444);
    const dimensions = {
      buttonWidth: 156,
      buttonHeight: 97,
      imageLeft: 8,
      imageTop: 7,
      imageWidth: 140,
      imageHeight: 54,
    };
    const edge = projectRouteEdge(
      { ...dimensions, centerX: 316, centerY: 287 },
      { ...dimensions, centerX: 687, centerY: 422 },
      { width: 928.4, height: 844 },
    );
    const points = (edge.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    expect((points[0] * 928.4) / 1000).toBeCloseTo(396, 8);
    expect((points[1] * 844) / 1000).toBeCloseTo(272.5, 8);
    expect((points[6] * 928.4) / 1000).toBeCloseTo(607, 8);
    expect((points[7] * 844) / 1000).toBeCloseTo(407.5, 8);
    expect(points[2]).toBeGreaterThan(points[0]);
    expect(points[4]).toBeLessThan(points[6]);
    app.send({ type: "focused", target: { kind: "return" } });
    expect(app.send({ type: "key", key: "Tab", code: "Tab", shift: true }).handled).toBe(false);
    expect(app.state.focus).toBeNull();
    expect(app.send({ type: "key", key: "Tab", code: "Tab", shift: false }).handled).toBe(true);
    expect(app.state.focus).toEqual({ kind: "return" });
    app.send({ type: "enter", nodeId: "conversation-b" });
    app.send({ type: "advance" });
    app.send({ type: "choose", optionId: "mark-on-map" });
    app.send({ type: "route", event: { type: "measured", measure } });
    expect(projectDungeon(app.state, app.input).route).toMatchObject({ width: 580, offset: -306.5 });
  });

  it("分岐回復の発症結果を実コアから読み、回復と負荷を一度ずつ案内する", () => {
    for (const [physicalFatigue, symptom] of [
      [0, "肉体疲労 0 → 3。"],
      [200, "朦朧 0 → 3。"],
    ] as const) {
      const input = initial(5);
      if (!input.game.dungeon) throw new Error("探索を開始していること");
      const game = {
        ...input.game,
        dungeon: {
          ...input.game.dungeon,
          randomState: 1,
          party: input.game.dungeon.party.map((member) => ({
            ...member,
            mentalFatigue: 100,
            status: { ...healthyStatus(), physicalFatigue },
          })),
        },
      };
      const app = session({ ...input, game });
      app.send({ type: "branch", event: { type: "open-skill" } });
      app.send({ type: "branch", event: { type: "actor", id: "player" } });
      app.send({ type: "branch", event: { type: "skill", id: "test-heal" } });
      const applied = app.send({ type: "branch", event: { type: "target", id: "player" } });
      expect(applied.handled).toBe(true);
      expect(applied.game.dungeon?.party[0].mentalFatigue).toBe(103);
      expect(applied.game.dungeon?.randomState).toBe(1586005467);
      expect(projectDungeon(app.state, app.input).branchResult).toBe(
        `HPを${physicalFatigue === 0 ? "9" : "1"}回復。精神疲労 100 → 103。${symptom}`,
      );
    }
  });

  it("戦闘中の物品は現在のバッグと確定回復へ結線し、外側Tab・省略・再使用を現在状態で扱う", () => {
    const app = session(initial(5, directBoss));
    app.send({ type: "enter", nodeId: "boss" });
    expect(projectDungeon(app.state, app.input).battle?.status).toMatchObject({ ready: false, error: false });
    expect(app.send({ type: "enter", nodeId: "boss" }).handled).toBe(false);
    app.send({ type: "battle", event: { type: "scene-ready", owner: 1 } });
    app.send({ type: "motion", reduced: true });
    app.send({ type: "battle", event: { type: "focused", target: { kind: "enemy", id: "enemy" } } });
    const untouched = structuredClone(app.input.game);
    expect(app.send({ type: "battle", event: { type: "key", key: "Tab", shift: true } }).handled).toBe(false);
    expect(app.state.focus).toBeNull();
    expect(app.input.game).toEqual(untouched);
    for (const [hp, stock] of [
      [8, 1],
      [11, 0],
    ] as const) {
      app.send({ type: "battle", event: { type: "open-item" } });
      expect(projectDungeon(app.state, app.input).battle?.view?.items).toMatchObject({ open: true, useEnabled: true });
      expect(app.send({ type: "battle", event: { type: "use-item" } }).handled).toBe(true);
      expect(app.input.game.dungeon?.party.find(({ id }) => id === "player")?.hp).toBe(hp);
      if (!app.input.game.inventory) throw new Error("物品を持ち込んでいること");
      expect(bagItemQuantity(app.input.game.inventory.items, recoveryItemId)).toBe(stock);
      app.send({ type: "battle", event: { type: "playback", event: { type: "skip" } } });
      expect(projectDungeon(app.state, app.input).battle?.view?.allies[0].hp).toBe(String(hp));
    }
    expect(app.send({ type: "battle", event: { type: "open-item" } }).handled).toBe(false);
  });
});
