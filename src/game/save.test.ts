import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { saveDefinitions as definitions } from "../content/saveDefinitions";
import { createInitialGameState } from "./createInitialGameState";
import {
  actInExpedition,
  actInTown,
  applyPartyStatus,
  beginTownExploration,
  departOnExpedition,
  type ExpeditionGame,
  editExpeditionParty,
  leaveExpedition,
  receiveTownRecoverySignal,
} from "./expedition";
import { createGameRandom, nextGameRandom } from "./gameRandom";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";

interface SavePayload {
  adventure: { currentPlaceId: string; flags: string[] };
  party: {
    members: { id: string; hp: number; status: { haze: number; incapacityRecoverySteps: number | null } }[];
    slots: (string | null)[];
  };
  clock: { elapsedHalfDays: number; recoverySteps: number };
  randomState: number;
  lastTownRecoverySignal: number | null;
}
function initial(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
  };
}
function encoded(game: ExpeditionGame): string {
  const result = serializeGame(game, definitions);
  if (!result.accepted) throw new Error(result.reason);
  return result.data;
}
function restored(game: ExpeditionGame): ExpeditionGame {
  const result = deserializeGame(encoded(game), definitions);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
function market(game: ExpeditionGame): ExpeditionGame {
  const started = beginTownExploration(game, "market", initialAdventure);
  if (!started.accepted) throw new Error(started.reason);
  const ended = actInTown(
    started.state,
    started.state.clock?.pendingAction?.id ?? -1,
    { type: "advance" },
    characters,
    initialAdventure,
  );
  if (!ended.accepted) throw new Error(ended.reason);
  return ended.state;
}

describe("街のセーブ", () => {
  it("ダンジョン帰還の半日を療養に算入せず復元する", () => {
    let fatigued = applyPartyStatus(initial(), "player", { kind: "physicalFatigue", amount: 10 }, characters);
    fatigued = applyPartyStatus(fatigued, "player", { kind: "physicalFatigue", amount: 10 }, characters);
    let game = departOnExpedition(fatigued, characters, initialDungeon, initialAdventure).state;
    for (const command of [
      { type: "enter", nodeId: "conversation-b" },
      { type: "advance" },
      { type: "choose", optionId: "continue-without-marking" },
      { type: "enter", nodeId: "boss-c" },
      { type: "attack", actorId: "player", targetId: "ruin-warden" },
    ] as const) {
      const update = actInExpedition(game, command, initialDungeon, initialAdventure);
      if (!update.result.accepted) throw new Error(update.result.reason);
      game = update.state;
    }
    for (let turn = 0; game.dungeon?.activity?.type === "battle" && turn < 10; turn++) {
      const update = actInExpedition(
        game,
        { type: "attack", actorId: "player", targetId: "ruin-warden" },
        initialDungeon,
        initialAdventure,
      );
      if (!update.result.accepted) throw new Error(update.result.reason);
      game = update.state;
    }
    const returned = leaveExpedition(game);
    if (!returned.accepted) throw new Error(returned.reason);
    const loaded = restored(returned.state);
    expect(loaded.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0 });
    expect(loaded.party.members[0]).toMatchObject({
      hp: 16,
      status: { physicalFatigue: 20, incapacityRecoverySteps: null },
    });
  });
  it("症状値30から街探索後の20とHPを復元し、次の街探索で10へ回復する", () => {
    let game = initial();
    for (let tier = 0; tier < 3; tier++)
      game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 10 }, characters);
    game = market(game);
    const loaded = restored(game);
    expect(loaded.party.members[0]).toMatchObject({ hp: 15, status: { physicalFatigue: 20 } });
    expect(loaded.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    const next = market(loaded);
    expect(next.party.members[0]).toMatchObject({ hp: 15, status: { physicalFatigue: 10 } });
    expect(next.clock).toMatchObject({ elapsedHalfDays: 2, recoverySteps: 2 });
  });
  it("HP満タンの戦闘不能6回と1回を区別し、読み込みで回復させない", () => {
    let game = applyPartyStatus(initial(), "player", { kind: "incapacity" }, characters);
    let loaded = restored(game);
    expect(loaded.party.members[0]).toMatchObject({ hp: 20, status: { incapacityRecoverySteps: 6 } });
    for (let step = 0; step < 5; step++) game = market(game);
    loaded = restored(game);
    expect(loaded.party.members[0]).toMatchObject({ hp: 20, status: { incapacityRecoverySteps: 1 } });
    expect(departOnExpedition(loaded, characters, initialDungeon, initialAdventure).accepted).toBe(false);
    expect(market(loaded).party.members[0].status?.incapacityRecoverySteps).toBeNull();
  });
  it("加入フラグ、控え、空き枠、現在地を保持し、同じ相手を再加入させない", () => {
    const started = beginTownExploration(initial(), "find-companion", initialAdventure);
    if (!started.accepted) throw new Error(started.reason);
    const id = started.state.clock?.pendingAction?.id ?? -1;
    const line = actInTown(started.state, id, { type: "advance" }, characters, initialAdventure);
    const joined = actInTown(
      line.state,
      id,
      { type: "choose", optionId: "invite-gilberta" },
      characters,
      initialAdventure,
    );
    if (!joined.accepted) throw new Error(joined.reason);
    const loaded = restored(joined.state);
    expect(loaded.adventure).toMatchObject({ currentPlaceId: "find-companion", flags: ["joined-gilberta"] });
    expect(loaded.party.members.map(({ id }) => id)).toEqual(["player", "gilberta"]);
    expect(loaded.party.slots).toEqual(["player", null, null, null]);
    const again = beginTownExploration(loaded, "find-companion", initialAdventure);
    const completed = actInTown(
      again.state,
      again.state.clock?.pendingAction?.id ?? -1,
      { type: "advance" },
      characters,
      initialAdventure,
    );
    expect(completed.state.party.members).toHaveLength(2);
    const empty = editExpeditionParty(loaded, 0, null);
    expect(restored(empty.state).party.slots).toEqual([null, null, null, null]);
  });
  it("乱数と回復通知の重複抑止を復元する", () => {
    let game = receiveTownRecoverySignal(initial(), 100, characters);
    game = { ...game, randomState: createGameRandom(0) };
    game = applyPartyStatus(game, "player", { kind: "haze", amount: 10 }, characters);
    const loaded = restored(game);
    expect(nextGameRandom(loaded.randomState ?? -1)).toEqual({ state: 1013904223, value: 1013904223 / 4294967296 });
    expect(receiveTownRecoverySignal(loaded, 100, characters).party.members[0].status?.haze).toBe(10);
    expect(receiveTownRecoverySignal(loaded, 101, characters).party.members[0].status?.haze).toBe(0);
  });
  it("会話、必須選択、探索途中を保存しない", () => {
    const started = beginTownExploration(initial(), "find-companion", initialAdventure);
    const choice = actInTown(
      started.state,
      started.state.clock?.pendingAction?.id ?? -1,
      { type: "advance" },
      characters,
      initialAdventure,
    );
    const departed = departOnExpedition(initial(), characters, initialDungeon, initialAdventure);
    for (const game of [started.state, choice.state, departed.state])
      expect(serializeGame(game, definitions)).toMatchObject({ accepted: false, reason: "not-in-town" });
  });
  it.each([
    (v: SavePayload) => {
      v.adventure.currentPlaceId = "missing";
    },
    (v: SavePayload) => {
      v.party.members[0].id = "missing";
    },
    (v: SavePayload) => {
      v.party.slots[1] = "player";
    },
    (v: SavePayload) => {
      v.party.slots[1] = "gilberta";
    },
    (v: SavePayload) => {
      v.party.members[0].hp = 21;
    },
    (v: SavePayload) => {
      v.party.members[0].status.haze = 201;
    },
    (v: SavePayload) => {
      v.party.members[0].status.incapacityRecoverySteps = 0;
    },
    (v: SavePayload) => {
      v.clock.elapsedHalfDays = 1;
    },
    (v: SavePayload) => {
      v.clock.recoverySteps = 1;
    },
    (v: SavePayload) => {
      v.randomState = -1;
    },
    (v: SavePayload) => {
      v.lastTownRecoverySignal = 0.5;
    },
  ])("不正な外部データを拒否する %#", (corrupt) => {
    const value = JSON.parse(encoded(initial()));
    corrupt(value);
    expect(deserializeGame(JSON.stringify(value), definitions).accepted).toBe(false);
  });
  it("加入済みと未加入の矛盾、回復の重複抑止値の欠落を拒否する", () => {
    const value = JSON.parse(encoded(initial()));
    value.adventure.flags = ["joined-gilberta"];
    expect(deserializeGame(JSON.stringify(value), definitions).accepted).toBe(false);
    const recovered = JSON.parse(encoded(market(initial())));
    recovered.lastTownRecoverySignal = null;
    expect(deserializeGame(JSON.stringify(recovered), definitions).accepted).toBe(false);
  });
  it("壊れたJSONと未対応形式を拒否する", () => {
    expect(deserializeGame("{", definitions)).toMatchObject({ accepted: false, reason: "invalid-data" });
    expect(deserializeGame('{"version":999}', definitions)).toMatchObject({
      accepted: false,
      reason: "unsupported-version",
    });
  });
});

describe("保存JSONの公開境界", () => {
  it.each([
    [
      "仲間の重複",
      "party.members",
      [
        {
          id: "player",
          hp: 20,
          mentalFatigue: 0,
          status: { physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null },
        },
        {
          id: "player",
          hp: 20,
          mentalFatigue: 0,
          status: { physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null },
        },
      ],
    ],
    ["PT枠不足", "party.slots", ["player", null, null]],
    ["PT枠過剰", "party.slots", ["player", null, null, null, null]],
    ["負のHP", "party.members.0.hp", -1],
    ["数値でないHP", "party.members.0.hp", "20"],
    ["重複フラグ", "adventure.flags", ["seen", "seen"]],
    ["空フラグ", "adventure.flags", [""]],
    ["整数でない生活時計", "clock.elapsedHalfDays", 0.5],
    ["安全整数外の生活時計", "clock.elapsedHalfDays", Number.MAX_SAFE_INTEGER],
    ["負の療養回数", "clock.recoverySteps", -1],
    ["行動IDのゼロ", "clock.nextActionId", 0],
    ["生活時計と行動IDの矛盾", "clock.nextActionId", 2],
    ["負の処理済通知", "lastTownRecoverySignal", -1],
    ["負の物品版", "inventory.items.version", -1],
    ["端数の物品版", "inventory.items.version", 0.5],
    ["端数の所持金", "inventory.balance", 0.5],
    ["探索バッグの残存", "inventory.items.exploration", {}],
    ["未定義の重要品", "inventory.items.importantIds", ["unknown-important"]],
  ])("%sを修復せず拒否する", (_label, path, replacement) => {
    const payload = JSON.parse(encoded(initial()));
    const fields = String(path).split(".");
    let target = payload;
    for (const field of fields.slice(0, -1)) target = target[field];
    target[fields.at(-1) ?? ""] = replacement;
    expect(deserializeGame(JSON.stringify(payload), definitions)).toEqual({ accepted: false, reason: "invalid-data" });
  });

  it("現行JSONの必須フィールド欠落と余分なフィールドを拒否する", () => {
    const source = JSON.parse(encoded(initial()));
    for (const path of [
      [],
      ["adventure"],
      ["party"],
      ["clock"],
      ["inventory"],
      ["inventory", "items"],
      ["party", "members", "0"],
      ["party", "members", "0", "status"],
    ]) {
      const locate = (payload: Record<string, unknown>) => {
        let record = payload;
        for (const key of path) record = record[key] as Record<string, unknown>;
        return record;
      };
      const withExtra = structuredClone(source);
      locate(withExtra).unexpected = true;
      expect(deserializeGame(JSON.stringify(withExtra), definitions), `extra: ${path.join(".")}`).toEqual({
        accepted: false,
        reason: "invalid-data",
      });
      for (const key of Object.keys(locate(source)).filter((key) => key !== "version")) {
        const missing = structuredClone(source);
        delete locate(missing)[key];
        expect(deserializeGame(JSON.stringify(missing), definitions), `missing: ${[...path, key].join(".")}`).toEqual({
          accepted: false,
          reason: "invalid-data",
        });
      }
    }
  });

  it.each([0, 0xffffffff])("乱数の合法な端点%sを保持し、読込で進めない", (randomState) => {
    const game = { ...initial(), randomState };
    const loaded = restored(game);
    expect(loaded.randomState).toBe(randomState);
    expect(loaded.clock).toMatchObject({ elapsedHalfDays: 0, recoverySteps: 0, nextActionId: 1, pendingAction: null });
    expect(loaded.party.members[0].hp).toBe(20);
  });
});
