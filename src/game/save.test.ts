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
    let fatigued = applyPartyStatus(initial(), "player", "physicalFatigue", characters);
    fatigued = applyPartyStatus(fatigued, "player", "physicalFatigue", characters);
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
      hp: 10,
      status: { physicalFatigue: 2, incapacityRecoverySteps: 6 },
    });
  });
  it("重度から街探索後の中度とHPを復元し、次の探索で軽度へ回復する", () => {
    let game = initial();
    for (let tier = 0; tier < 3; tier++) game = applyPartyStatus(game, "player", "physicalFatigue", characters);
    game = market(game);
    const loaded = restored(game);
    expect(loaded.party.members[0]).toMatchObject({ hp: 5, status: { physicalFatigue: 2 } });
    expect(loaded.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    const next = market(loaded);
    expect(next.party.members[0]).toMatchObject({ hp: 5, status: { physicalFatigue: 1 } });
    expect(next.clock).toMatchObject({ elapsedHalfDays: 2, recoverySteps: 2 });
  });
  it("HP満タンの戦闘不能6回と1回を区別し、読み込みで回復させない", () => {
    let game = applyPartyStatus(initial(), "player", "incapacity", characters);
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
    game = applyPartyStatus(game, "player", "haze", characters);
    const loaded = restored(game);
    expect(nextGameRandom(loaded.randomState ?? -1)).toEqual({ state: 1013904223, value: 1013904223 / 4294967296 });
    expect(receiveTownRecoverySignal(loaded, 100, characters).party.members[0].status?.haze).toBe(1);
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
      v.party.members[0].status.haze = 4;
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
    expect(deserializeGame('{"version":2}', definitions)).toMatchObject({
      accepted: false,
      reason: "unsupported-version",
    });
  });
});
