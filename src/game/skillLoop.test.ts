import { describe, expect, it } from "vitest";
import { completeMarketVisit } from "../../tests/helpers/completeMarketVisit";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "./createInitialGameState";
import {
  actInExpedition,
  actInTown,
  beginTownExploration,
  type DungeonCommand,
  departOnExpedition,
  type ExpeditionGame,
  leaveExpedition,
} from "./expedition";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";

const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition };
function initial(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
  };
}
function act(game: ExpeditionGame, command: DungeonCommand): ExpeditionGame {
  const update = actInExpedition(game, command, initialDungeon, initialAdventure, rules);
  if (!update.result.accepted) throw new Error(update.result.reason);
  return update.state;
}
function input(game: ExpeditionGame, targetId: string, skillId = "test-strike"): DungeonCommand {
  if (game.dungeon?.activity?.type !== "battle") throw new Error("戦闘入力待ちではありません");
  return {
    type: "skill",
    actorId: "player",
    targetId,
    skillId,
    expectedNodeId: game.dungeon.activeNodeId ?? "",
    expectedActionTime: game.dungeon.activity.state.logicalTime,
    expeditionActionId: game.dungeon.expeditionActionId ?? -1,
  };
}
function fatigue(game: ExpeditionGame) {
  return game.party.members[0].mentalFatigue;
}
function saved(game: ExpeditionGame): string {
  const result = serializeGame(game, saveDefinitions);
  if (!result.accepted) throw new Error(result.reason);
  return result.data;
}
function loaded(data: string): ExpeditionGame {
  const result = deserializeGame(data, saveDefinitions);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
describe("通常探索から街保存までのスキルループ", () => {
  it("次戦・帰還へ19を持ち越し、読込でも回復せず街探索一回で9へ回復する", () => {
    let game = departOnExpedition(initial(), characters, initialDungeon, initialAdventure, rules).state;
    game = act(game, { type: "enter", nodeId: "battle-a" });
    const oldInput = input(game, "slime");
    game = act(game, oldInput);
    expect(fatigue(game)).toBe(4);
    const resent = actInExpedition(game, oldInput, initialDungeon, initialAdventure, rules);
    expect(resent.result).toMatchObject({ accepted: false, reason: "battle:action-not-current" });
    expect(resent.state).toEqual(game);
    game = act(game, input(game, "player", "test-heal"));
    expect(fatigue(game)).toBe(7);
    game = act(game, input(game, "slime-2"));
    expect(fatigue(game)).toBe(11);
    game = act(game, { type: "enter", nodeId: "boss-c" });
    const staleNode = actInExpedition(game, oldInput, initialDungeon, initialAdventure, rules);
    expect(staleNode.result).toMatchObject({ accepted: false, reason: "battle:action-not-current" });
    expect(staleNode.state).toEqual(game);
    game = act(game, input(game, "ruin-warden"));
    expect(game.dungeon?.activity).toMatchObject({
      type: "battle",
      state: {
        combatants: expect.arrayContaining([
          expect.objectContaining({ id: "ruin-warden", hp: expect.closeTo(13.585585585585585, 10) }),
        ]),
      },
    });
    game = act(game, input(game, "ruin-warden"));
    expect(game.dungeon?.outcome).toBe("cleared");
    game = leaveExpedition(game).state;
    expect(fatigue(game)).toBe(19);
    expect(game.party.members[0].hp).toBe(19);
    expect(game.party.members[0].status?.physicalFatigue).toBe(4);
    expect(game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0 });
    game = loaded(saved(game));
    expect(fatigue(game)).toBe(19);
    game = loaded(saved(game));
    expect(fatigue(game)).toBe(19);
    const begun = beginTownExploration(game, "market", initialAdventure);
    if (!begun.accepted) throw new Error(begun.reason);
    const completed = actInTown(
      begun.state,
      { type: "advance" },
      characters,
      initialAdventure,
      mentalFatigueDefinition,
    );
    if (!completed.accepted) throw new Error(completed.reason);
    expect(fatigue(completed.state)).toBe(9);
    expect(completed.state.clock).toMatchObject({ elapsedHalfDays: 2, recoverySteps: 1 });
    expect(
      actInTown(completed.state, { type: "advance" }, characters, initialAdventure, mentalFatigueDefinition),
    ).toMatchObject({ accepted: false, state: completed.state });
    const next = departOnExpedition(completed.state, characters, initialDungeon, initialAdventure, rules).state;
    expect(actInExpedition(next, oldInput, initialDungeon, initialAdventure, rules).state).toEqual(next);
    expect(next.dungeon?.party[0].mentalFatigue).toBe(9);
  });
  it("街の完了は控えの端数疲労も回復し、探索中・帰還では街回復を進めない", () => {
    const original = initial();
    const party = createParty(characters, ["player", "gilberta"]);
    let game: ExpeditionGame = {
      ...original,
      party: {
        ...party,
        members: party.members.map((member) => ({ ...member, mentalFatigue: member.id === "player" ? 35.5 : 8.25 })),
      },
    };
    game = completeMarketVisit(game, characters, mentalFatigueDefinition);
    expect(game.party.members.map((member) => member.mentalFatigue)).toEqual([25.5, 0]);
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    expect(beginTownExploration(game, "market", initialAdventure)).toMatchObject({ accepted: false, state: game });
    expect(fatigue(game)).toBe(25.5);
    game = leaveExpedition(game).state;
    expect(fatigue(game)).toBe(25.5);
  });
  it("旧版を移行せず拒否し、現行版の端数疲労を精度保持する", () => {
    const restored = initial();
    for (const version of [1, 2]) {
      const payload = JSON.parse(saved(initial()));
      payload.version = version;
      delete payload.growth;
      expect(deserializeGame(JSON.stringify(payload), saveDefinitions)).toEqual({
        accepted: false,
        reason: "unsupported-version",
      });
    }
    const fractional = {
      ...restored,
      party: {
        ...restored.party,
        members: restored.party.members.map((member) => ({ ...member, mentalFatigue: 24.1234567890123 })),
      },
    };
    expect(fatigue(loaded(saved(fractional)))).toBe(24.1234567890123);
    const invalid = JSON.parse(saved(restored));
    for (const value of [-1, null, "1"]) {
      invalid.party.members[0].mentalFatigue = value;
      expect(deserializeGame(JSON.stringify(invalid), saveDefinitions)).toMatchObject({
        accepted: false,
        reason: "invalid-data",
      });
    }
  });
});
