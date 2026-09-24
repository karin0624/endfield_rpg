import type { DungeonDefinition } from "../game/dungeon";
import { initialBattleCombatants } from "./initialBattle";

/** One fixed, single-floor route with a branch, a merge, and a terminal boss node. */
export const initialDungeon = {
  id: "roadside-ruins",
  entryNodeId: "entrance",
  party: initialBattleCombatants.filter((combatant) => combatant.team === "ally"),
  nodes: [
    {
      id: "entrance",
      label: "遺跡の入口",
      type: "start",
      nextNodeIds: ["battle-a", "conversation-b"],
    },
    {
      id: "battle-a",
      label: "崩れた通路",
      type: "battle",
      enemies: initialBattleCombatants.filter((combatant) => combatant.team === "enemy"),
      nextNodeIds: ["boss-c"],
    },
    {
      id: "conversation-b",
      label: "足跡の調査",
      type: "conversation",
      conversationId: "dungeon-scouting",
      nextNodeIds: ["boss-c"],
    },
    {
      id: "boss-c",
      label: "遺跡の守り手",
      type: "boss",
      enemies: [{ id: "ruin-warden", team: "enemy", speed: 85, hp: 28, attackPower: 5 }],
      nextNodeIds: [],
    },
  ],
} as const satisfies DungeonDefinition;
