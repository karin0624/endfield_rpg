import { describe, expect, it } from "vitest";
import { initialAdventure } from "../content/initialAdventure";
import { initialBattleCombatants } from "../content/initialBattle";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import {
  type AdventureDefinition,
  assertValidAdventureDefinition,
  type ConversationChoiceOption,
  getAvailableTownPlaces,
  selectTownPlace,
} from "./adventure";
import { createInitialGameState } from "./createInitialGameState";
import { assertValidDungeonDefinition, type DungeonDefinition, type DungeonNodeDefinition } from "./dungeon";

const party = initialBattleCombatants.filter((member) => member.team === "ally");
function changedNode(id: string, patch: Partial<DungeonNodeDefinition>): DungeonDefinition {
  return {
    ...initialDungeon,
    nodes: initialDungeon.nodes.map((node) =>
      node.id === id ? ({ ...node, ...patch } as DungeonNodeDefinition) : node,
    ),
  };
}
describe("公開定義の拒否契約", () => {
  it.each([
    [
      "duplicate node",
      { ...initialDungeon, nodes: [...initialDungeon.nodes, initialDungeon.nodes[0]] },
      /ノードIDが重複/,
    ],
    ["duplicate edge", changedNode("entrance", { nextNodeIds: ["battle-a", "battle-a"] }), /接続先ノードIDが重複/],
    ["self edge", changedNode("battle-a", { nextNodeIds: ["battle-a"] }), /自身への接続/],
    ["return to start", changedNode("battle-a", { nextNodeIds: ["entrance"] }), /入口ノードへ戻る/],
    [
      "cycle",
      {
        ...initialDungeon,
        nodes: initialDungeon.nodes.map((node) =>
          node.id === "battle-a"
            ? { ...node, nextNodeIds: ["conversation-b"] }
            : node.id === "conversation-b"
              ? { ...node, nextNodeIds: ["battle-a", "boss-c"] }
              : node,
        ),
      },
      /循環/,
    ],
    ["unreachable node", changedNode("entrance", { nextNodeIds: ["battle-a"] }), /到達できない/],
    [
      "duplicate start",
      {
        ...initialDungeon,
        nodes: [...initialDungeon.nodes, { id: "other", label: "other", type: "start", nextNodeIds: ["boss-c"] }],
      },
      /start型ノードは/,
    ],
    ["missing boss", changedNode("boss-c", { type: "battle" }), /boss型ノード/],
    [
      "duplicate boss",
      {
        ...initialDungeon,
        nodes: [...initialDungeon.nodes, { ...initialDungeon.nodes.find((node) => node.type === "boss"), id: "other" }],
      },
      /boss型ノード/,
    ],
    ["boss edge", changedNode("boss-c", { nextNodeIds: ["battle-a"] }), /boss型ノード/],
    ["dead end", changedNode("battle-a", { nextNodeIds: [] }), /終端以外のノード/],
  ] as const)("dungeon rejects %s", (_name, definition, message) => {
    expect(() => assertValidDungeonDefinition(definition as DungeonDefinition, initialAdventure, party)).toThrow(
      message,
    );
  });
  it("availableWhen requires all flags and excludes any forbidden flag for both listing and direct input", () => {
    const definition: AdventureDefinition = {
      ...initialAdventure,
      places: initialAdventure.places.map((place) => ({
        ...place,
        availableWhen: { all: ["a", "b"], none: ["closed"] },
      })),
    };
    for (const flags of [[], ["a"], ["b"], ["a", "b", "closed"]]) {
      const state = { ...createInitialGameState(initialGameOptions), flags };
      expect(getAvailableTownPlaces(state, definition)).toEqual([]);
      expect(selectTownPlace(state, "market", definition)).toEqual({
        accepted: false,
        reason: "place-unavailable",
        state,
      });
    }
    const state = { ...createInitialGameState(initialGameOptions), flags: ["a", "b"] };
    expect(getAvailableTownPlaces(state, definition).map((place) => place.id)).toContain("market");
    expect(selectTownPlace(state, "market", definition).accepted).toBe(true);
  });
  it.each(["missing default", "duplicate option", "empty options"])("adventure rejects %s", (kind) => {
    const definition: AdventureDefinition = {
      ...initialAdventure,
      conversations: initialAdventure.conversations.map((conversation) => ({
        ...conversation,
        nodes: Object.fromEntries(
          Object.entries(conversation.nodes).map(([id, node]) => [
            id,
            node.type !== "choice"
              ? node
              : {
                  ...node,
                  options:
                    kind === "empty options"
                      ? []
                      : kind === "duplicate option"
                        ? [...node.options, node.options[0]]
                        : node.options.map((option: ConversationChoiceOption) => ({
                            ...option,
                            when: { all: ["locked"] },
                          })),
                },
          ]),
        ),
      })),
    };
    expect(() => assertValidAdventureDefinition(definition)).toThrow(
      kind === "missing default" ? /既定選択肢/ : kind === "duplicate option" ? /選択肢IDが重複/ : /選択肢がありません/,
    );
  });
});
