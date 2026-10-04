import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "./createInitialGameState";
import type { DungeonDefinition } from "./dungeon";
import {
  actInExpedition,
  actInTown,
  applyPartyStatus,
  beginTownExploration,
  departOnExpedition,
  type ExpeditionGame,
  editExpeditionParty,
  leaveExpedition,
} from "./expedition";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";
import { effectiveHitRate, effectiveMaxHp, healthyStatus } from "./status";

// Initial scenario definitions, not mid-play injections. HP200 / hit80% are acceptance values.
const definitions = characters.map((character) => ({ ...character, maxHp: 200, hitRate: 0.8, attackPower: 100 }));
const saves = {
  characters: definitions,
  placeIds: initialAdventure.places.map(({ id }) => id),
  recruitmentFlags: [{ flag: "joined-gilberta", characterId: "gilberta" }],
};
function start(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(definitions, ["player"]),
    dungeon: null,
    randomState: 1,
  };
}
function stage(initial: ExpeditionGame, count: number): ExpeditionGame {
  let game = initial;
  for (let i = 0; i < count; i++) {
    game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 10 }, definitions);
    game = applyPartyStatus(game, "player", { kind: "haze", amount: 10 }, definitions);
  }
  return game;
}
function roundTrip(game: ExpeditionGame): ExpeditionGame {
  const written = serializeGame(game, saves);
  if (!written.accepted) throw new Error(written.reason);
  const read = deserializeGame(written.data, saves);
  if (!read.accepted) throw new Error(read.reason);
  return read.state;
}
function town(game: ExpeditionGame, place = "market", invite = false): ExpeditionGame {
  const begun = beginTownExploration(game, place, initialAdventure);
  if (!begun.accepted) throw new Error(begun.reason);
  let update = actInTown(begun.state, { type: "advance" }, definitions, initialAdventure);
  if (invite)
    update = actInTown(update.state, { type: "choose", optionId: "invite-gilberta" }, definitions, initialAdventure);
  if (!update.accepted) throw new Error(update.reason);
  expect(actInTown(update.state, { type: "advance" }, definitions, initialAdventure).accepted).toBe(false);
  return update.state;
}
function expedition(
  initial: ExpeditionGame,
  route: DungeonDefinition,
  branch: "battle-a" | "conversation-b",
  expectedOutcome: "cleared" | "failed" = "cleared",
): ExpeditionGame {
  let game = initial;
  const before = game.clock?.elapsedHalfDays ?? 0;
  const begun = departOnExpedition(game, definitions, route, initialAdventure);
  if (!begun.accepted) throw new Error(begun.reason);
  game = begun.state;
  function act(command: Parameters<typeof actInExpedition>[1]) {
    const update = actInExpedition(game, command, route, initialAdventure);
    if (!update.result.accepted)
      throw new Error(`${update.result.reason}; rng=${game.randomState}; command=${JSON.stringify(command)}`);
    game = update.state;
    expect(game.clock?.elapsedHalfDays).toBe(before);
  }
  function fight() {
    for (let turn = 0; game.dungeon?.activity?.type === "battle" && turn < 30; turn++) {
      const battle = game.dungeon.activity.state;
      const target = battle.combatants.find((member) => member.team === "enemy" && member.hp > 0);
      if (!target || !battle.currentActorId) throw new Error("No battle input");
      act({ type: "attack", actorId: battle.currentActorId, targetId: target.id });
    }
  }
  act({ type: "enter", nodeId: branch });
  if (branch === "conversation-b") {
    act({ type: "advance" });
    act({ type: "choose", optionId: "mark-on-map" });
  } else fight();
  if (game.dungeon?.outcome === "ongoing") {
    act({ type: "enter", nodeId: "boss-c" });
    fight();
  }
  expect(game.dungeon?.outcome).toBe(expectedOutcome);
  if (branch === "battle-a") expect(game.party.members[0].hp).toBeLessThan(153);
  const returned = leaveExpedition(game);
  if (!returned.accepted) throw new Error(returned.reason);
  expect(leaveExpedition(returned.state).accepted).toBe(false);
  expect(returned.state.clock?.elapsedHalfDays).toBe(before + 1);
  return returned.state;
}
function effects(game: ExpeditionGame, hp: number, hit: number) {
  const status = game.party.members[0].status ?? healthyStatus();
  expect(effectiveMaxHp(200, status)).toBe(hp);
  expect(effectiveHitRate(0.8, status)).toBeCloseTo(hit);
}

describe("M2c生活ループ", () => {
  it.each(["cleared", "failed"] as const)("単独開始から%s帰還・療養・加入・再探索・復元までつなぐ", (outcome) => {
    let game = stage(start(), 3);
    expect(game.party.slots).toEqual(["player", null, null, null]);
    const route: DungeonDefinition =
      outcome === "cleared"
        ? initialDungeon
        : {
            ...initialDungeon,
            nodes: initialDungeon.nodes.map((node) =>
              node.type === "boss"
                ? { ...node, enemies: [{ id: "ruin-warden", team: "enemy", speed: 200, hp: 28, attackPower: 300 }] }
                : node,
            ),
          };
    game = expedition(game, route, outcome === "cleared" ? "battle-a" : "conversation-b", outcome);
    expect(game.party.members[0]).toMatchObject({
      hp: 153,
      status: { physicalFatigue: 30, haze: 30, incapacityRecoverySteps: outcome === "failed" ? 6 : null },
    });
    expect(game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0 });
    game = roundTrip(town(game));
    effects(game, 166, 0.75);
    expect(game.party.members[0].hp).toBe(153);
    game = town(game, "find-companion", true);
    effects(game, 181, 0.7741935483870968);
    expect(game.party.members.map(({ id }) => id)).toEqual(["player", "gilberta"]);
    expect(game.party.slots).toEqual(["player", null, null, null]);
    game = town(game, "find-companion");
    effects(game, 200, 0.8);
    expect(game.party.members).toHaveLength(2);
    if (outcome === "failed") {
      for (let step = 4; step <= 6; step++) {
        game = town(game);
        expect(game.party.members[0].status?.incapacityRecoverySteps).toBe(step === 6 ? null : 6 - step);
        expect(departOnExpedition(game, definitions, initialDungeon, initialAdventure).accepted).toBe(step === 6);
      }
    }
    // Rossi stays in reserve with its prior HP; Gilberta departs from the fourth slot.
    game = editExpeditionParty(game, 0, null).state;
    game = editExpeditionParty(game, 3, "gilberta").state;
    game = expedition(game, initialDungeon, "conversation-b");
    game = roundTrip(game);
    expect(game.party.slots).toEqual([null, null, null, "gilberta"]);
    expect(game.party.members[0].hp).toBe(153);
    expect(game.party.members[1].hp).toBe(200);
    expect(game.adventure.flags).toContain("marked-ruins-route");
    expect(game.adventure.flags).toContain("joined-gilberta");
    expect(game.clock).toMatchObject({
      elapsedHalfDays: outcome === "failed" ? 8 : 5,
      recoverySteps: outcome === "failed" ? 6 : 3,
    });
    expect(game.randomState).toBe(outcome === "failed" ? 1015568748 : 3027450565);
  });
  it("症状値20から街・ダンジョン・街で10・10・0になり、生活1.5日と療養1日を区別する", () => {
    let game = roundTrip(town(stage(start(), 2)));
    effects(game, 181, 0.7741935483870968);
    expect(game.party.members[0].hp).toBe(166);
    game = roundTrip(expedition(game, initialDungeon, "conversation-b"));
    effects(game, 181, 0.7741935483870968);
    expect(game.party.members[0].hp).toBe(181);
    expect(game.clock).toMatchObject({ elapsedHalfDays: 2, recoverySteps: 1 });
    game = town(game);
    effects(game, 200, 0.8);
    expect(game.party.members[0].hp).toBe(181);
    expect(game.clock).toMatchObject({ elapsedHalfDays: 3, recoverySteps: 2 });
  });
});
