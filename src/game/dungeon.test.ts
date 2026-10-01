import { describe, expect, it } from "vitest";

import { initialAdventure } from "../content/initialAdventure";
import { initialBattleCombatants } from "../content/initialBattle";
import { initialDungeon } from "../content/initialDungeon";
import {
  advanceDungeonConversation,
  assertValidDungeonDefinition,
  chooseDungeonConversationOption,
  createDungeonState,
  type DungeonDefinition,
  type DungeonState,
  enterNextDungeonNode,
  getAvailableDungeonNodes,
  getCurrentDungeonConversationScene,
  performDungeonBasicAttack,
} from "./dungeon";

const demoParty = initialBattleCombatants.filter((member) => member.team === "ally");

function finishBattle(state: DungeonState, definition: DungeonDefinition): DungeonState {
  let current = state;
  while (current.activity?.type === "battle") {
    const battle = current.activity.state;
    const actorId = battle.currentActorId;
    if (actorId === null) {
      throw new Error("戦闘に入力待ちの行動者がいません");
    }
    const target = battle.combatants.find((combatant) => combatant.team === "enemy" && combatant.isAlive);
    if (target === undefined) {
      throw new Error("戦闘に生存した敵がいません");
    }
    const attack = performDungeonBasicAttack(current, actorId, target.id, definition);
    if (!attack.accepted) {
      throw new Error(`戦闘を進められません: ${attack.reason}`);
    }
    current = attack.state;
  }
  return current;
}

function finishConversation(state: DungeonState): DungeonState {
  let current = state;
  while (current.activity?.type === "conversation") {
    const scene = getCurrentDungeonConversationScene(current, initialAdventure);
    if (scene === null) {
      throw new Error("ダンジョン会話の場面がありません");
    }
    const step =
      scene.type === "choice"
        ? chooseDungeonConversationOption(current, "mark-on-map", initialAdventure)
        : advanceDungeonConversation(current, initialAdventure);
    if (!step.accepted) {
      throw new Error(`会話を進められません: ${step.reason}`);
    }
    current = step.state;
  }
  return current;
}

describe("固定ダンジョンの進行", () => {
  it("入口の2分岐を別々に通り、共通のボスを倒すとクリアする", () => {
    expect(() => assertValidDungeonDefinition(initialDungeon, initialAdventure, demoParty)).not.toThrow();

    let battleRoute = createDungeonState(initialDungeon, initialAdventure, demoParty);
    expect(getAvailableDungeonNodes(battleRoute, initialDungeon).map(({ id }) => id)).toEqual([
      "battle-a",
      "conversation-b",
    ]);
    expect(enterNextDungeonNode(battleRoute, "boss-c", initialDungeon, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "node-not-connected",
      state: battleRoute,
    });
    const battleStart = enterNextDungeonNode(battleRoute, "battle-a", initialDungeon, initialAdventure);
    expect(battleStart.accepted).toBe(true);
    if (!battleStart.accepted) return;
    expect(enterNextDungeonNode(battleStart.state, "boss-c", initialDungeon, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "node-in-progress",
    });
    battleRoute = finishBattle(battleStart.state, initialDungeon);
    expect(battleRoute).toMatchObject({ currentNodeId: "battle-a", activeNodeId: null, outcome: "ongoing" });
    expect(battleRoute.resolvedNodeIds).toContain("battle-a");
    expect(getAvailableDungeonNodes(battleRoute, initialDungeon).map(({ id }) => id)).toEqual(["boss-c"]);
    expect(enterNextDungeonNode(battleRoute, "battle-a", initialDungeon, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "node-already-resolved",
    });
    const bossStart = enterNextDungeonNode(battleRoute, "boss-c", initialDungeon, initialAdventure);
    expect(bossStart.accepted).toBe(true);
    if (!bossStart.accepted) return;
    const clearedByBattle = finishBattle(bossStart.state, initialDungeon);
    expect(clearedByBattle).toMatchObject({
      currentNodeId: "boss-c",
      activeNodeId: null,
      outcome: "cleared",
    });

    const initialConversationRoute = createDungeonState(initialDungeon, initialAdventure, demoParty);
    const conversationStart = enterNextDungeonNode(
      initialConversationRoute,
      "conversation-b",
      initialDungeon,
      initialAdventure,
    );
    expect(conversationStart.accepted).toBe(true);
    if (!conversationStart.accepted) return;
    expect(getCurrentDungeonConversationScene(conversationStart.state, initialAdventure)).toMatchObject({
      type: "line",
      text: "道の脇に、遺跡へ続く新しい足跡が残っている。",
    });
    const conversationRoute = finishConversation(conversationStart.state);
    expect(conversationRoute).toMatchObject({
      currentNodeId: "conversation-b",
      activeNodeId: null,
      outcome: "ongoing",
      flags: ["marked-ruins-route", "scouted-ruins"],
    });
    expect(conversationRoute.resolvedNodeIds).toContain("conversation-b");
    expect(getAvailableDungeonNodes(conversationRoute, initialDungeon).map(({ id }) => id)).toEqual(["boss-c"]);
    const bossStartFromConversation = enterNextDungeonNode(
      conversationRoute,
      "boss-c",
      initialDungeon,
      initialAdventure,
    );
    expect(bossStartFromConversation.accepted).toBe(true);
    if (!bossStartFromConversation.accepted) return;
    expect(finishBattle(bossStartFromConversation.state, initialDungeon).outcome).toBe("cleared");
  });

  it("keeps ally HP between battles while resetting enemy HP and the battle clock", () => {
    const definition = {
      id: "test-dungeon",
      entryNodeId: "entry",
      party: [{ id: "player", team: "ally", speed: 100, hp: 12, attackPower: 4 }],
      nodes: [
        { id: "entry", label: "入口", type: "start", nextNodeIds: ["first"] },
        {
          id: "first",
          label: "通路",
          type: "battle",
          enemies: [{ id: "enemy-first", team: "enemy", speed: 100, hp: 8, attackPower: 5 }],
          nextNodeIds: ["boss"],
        },
        {
          id: "boss",
          label: "ボス",
          type: "boss",
          enemies: [{ id: "enemy-boss", team: "enemy", speed: 100, hp: 8, attackPower: 1 }],
          nextNodeIds: [],
        },
      ],
    } as const satisfies DungeonDefinition & { party: readonly import("./battle").BattleCombatantDefinition[] };

    const firstStart = enterNextDungeonNode(
      createDungeonState(definition, initialAdventure, definition.party),
      "first",
      definition,
      initialAdventure,
    );
    expect(firstStart.accepted).toBe(true);
    if (!firstStart.accepted || firstStart.state.activity?.type !== "battle") return;
    const firstPlayerAction = performDungeonBasicAttack(firstStart.state, "player", "enemy-first", definition);
    expect(firstPlayerAction.accepted).toBe(true);
    if (!firstPlayerAction.accepted || firstPlayerAction.state.activity?.type !== "battle") return;
    expect(firstPlayerAction.state.party).toMatchObject([{ id: "player", hp: 7 }]);
    expect(firstPlayerAction.state.activity.state.logicalTime).toBe(200);

    const firstVictory = performDungeonBasicAttack(firstPlayerAction.state, "player", "enemy-first", definition);
    expect(firstVictory.accepted).toBe(true);
    if (!firstVictory.accepted) return;
    expect(firstVictory.state.activeNodeId).toBeNull();
    const bossStart = enterNextDungeonNode(firstVictory.state, "boss", definition, initialAdventure);
    expect(bossStart.accepted).toBe(true);
    if (!bossStart.accepted || bossStart.state.activity?.type !== "battle") return;
    expect(bossStart.state.party).toMatchObject([{ id: "player", hp: 7 }]);
    expect(bossStart.state.activity.state).toMatchObject({
      logicalTime: 100,
      currentActorId: "player",
    });
    expect(bossStart.state.activity.state.combatants.find(({ id }) => id === "enemy-boss")?.hp).toBe(8);
  });

  it("keeps a defeated ally incapacitated when another ally survives into the next battle", () => {
    const definition = {
      id: "test-incapacitated-party",
      entryNodeId: "entry",
      party: [
        { id: "player", team: "ally", speed: 100, hp: 3, attackPower: 4 },
        { id: "gilberta", team: "ally", speed: 90, hp: 15, attackPower: 4 },
      ],
      nodes: [
        { id: "entry", label: "入口", type: "start", nextNodeIds: ["first"] },
        {
          id: "first",
          label: "通路",
          type: "battle",
          enemies: [{ id: "enemy-first", team: "enemy", speed: 100, hp: 8, attackPower: 3 }],
          nextNodeIds: ["boss"],
        },
        {
          id: "boss",
          label: "ボス",
          type: "boss",
          enemies: [{ id: "enemy-boss", team: "enemy", speed: 100, hp: 30, attackPower: 1 }],
          nextNodeIds: [],
        },
      ],
    } as const satisfies DungeonDefinition & { party: readonly import("./battle").BattleCombatantDefinition[] };
    const start = enterNextDungeonNode(
      createDungeonState(definition, initialAdventure, definition.party),
      "first",
      definition,
      initialAdventure,
    );
    expect(start.accepted).toBe(true);
    if (!start.accepted) return;
    const playerAction = performDungeonBasicAttack(start.state, "player", "enemy-first", definition);
    expect(playerAction.accepted).toBe(true);
    if (!playerAction.accepted || playerAction.state.activity?.type !== "battle") return;
    expect(playerAction.state.activity.state.currentActorId).toBe("gilberta");
    expect(playerAction.state.activity.state.combatants.find(({ id }) => id === "player")).toMatchObject({
      hp: 0,
      isAlive: false,
    });
    const firstVictory = performDungeonBasicAttack(playerAction.state, "gilberta", "enemy-first", definition);
    expect(firstVictory.accepted).toBe(true);
    if (!firstVictory.accepted) return;
    expect(firstVictory.state).toMatchObject({
      activeNodeId: null,
      outcome: "ongoing",
      party: [
        { id: "player", hp: 0 },
        { id: "gilberta", hp: 15 },
      ],
    });

    const bossStart = enterNextDungeonNode(firstVictory.state, "boss", definition, initialAdventure);
    expect(bossStart.accepted).toBe(true);
    if (!bossStart.accepted || bossStart.state.activity?.type !== "battle") return;
    expect(bossStart.state.activity.state.combatants).toMatchObject([
      { id: "player", hp: 0, isAlive: false },
      { id: "gilberta", hp: 14, isAlive: true },
      { id: "enemy-boss", hp: 30, isAlive: true },
    ]);
    expect(bossStart.state.activity.state.currentActorId).toBe("gilberta");
  });

  it("losing a battle fails the dungeon and removes all onward choices", () => {
    const definition = {
      id: "test-defeat",
      entryNodeId: "entry",
      party: [{ id: "player", team: "ally", speed: 100, hp: 3, attackPower: 1 }],
      nodes: [
        { id: "entry", label: "入口", type: "start", nextNodeIds: ["battle"] },
        {
          id: "battle",
          label: "戦闘",
          type: "battle",
          enemies: [{ id: "enemy", team: "enemy", speed: 100, hp: 20, attackPower: 3 }],
          nextNodeIds: ["boss"],
        },
        {
          id: "boss",
          label: "ボス",
          type: "boss",
          enemies: [{ id: "boss-enemy", team: "enemy", speed: 100, hp: 20, attackPower: 1 }],
          nextNodeIds: [],
        },
      ],
    } as const satisfies DungeonDefinition & { party: readonly import("./battle").BattleCombatantDefinition[] };
    const start = enterNextDungeonNode(
      createDungeonState(definition, initialAdventure, definition.party),
      "battle",
      definition,
      initialAdventure,
    );
    expect(start.accepted).toBe(true);
    if (!start.accepted) return;
    const defeat = performDungeonBasicAttack(start.state, "player", "enemy", definition);
    expect(defeat.accepted).toBe(true);
    if (!defeat.accepted) return;
    expect(defeat.events).toContainEqual({ type: "battle-ended", outcome: "defeat" });
    expect(defeat.state).toMatchObject({ activeNodeId: null, outcome: "failed" });
    expect(getAvailableDungeonNodes(defeat.state, definition)).toEqual([]);
    expect(enterNextDungeonNode(defeat.state, "boss", definition, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "dungeon-ended",
    });
  });

  it("rejects graph references that do not point to a route node", () => {
    const invalid: DungeonDefinition = {
      ...initialDungeon,
      nodes: initialDungeon.nodes.map((node) =>
        node.id === "entrance" ? { ...node, nextNodeIds: ["missing"] } : node,
      ),
    };
    expect(() => assertValidDungeonDefinition(invalid, initialAdventure, demoParty)).toThrow(
      "接続先ノードが存在しません",
    );
  });

  it("returns to the same route node after a conversation instead of exposing a town state", () => {
    const start = enterNextDungeonNode(
      createDungeonState(initialDungeon, initialAdventure, demoParty),
      "conversation-b",
      initialDungeon,
      initialAdventure,
    );
    expect(start.accepted).toBe(true);
    if (!start.accepted) return;
    const noBattle = performDungeonBasicAttack(start.state, "player", "slime", initialDungeon);
    expect(noBattle).toMatchObject({ accepted: false, reason: "not-in-battle" });
    const noChoice = advanceDungeonConversation(
      createDungeonState(initialDungeon, initialAdventure, demoParty),
      initialAdventure,
    );
    expect(noChoice).toMatchObject({ accepted: false, reason: "not-in-conversation" });

    const state = finishConversation(start.state);
    expect(state.currentNodeId).toBe("conversation-b");
    expect(state.activity).toBeNull();
    expect(state.outcome).toBe("ongoing");
    expect(getAvailableDungeonNodes(state, initialDungeon).map(({ id }) => id)).toEqual(["boss-c"]);
  });
});
