import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialBattleCombatants } from "../content/initialBattle";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import {
  type AdventureDefinition,
  advanceConversation,
  assertValidAdventureDefinition,
  type ConversationChoiceOption,
  chooseConversationOption,
  getAvailableTownPlaces,
  getCurrentConversationScene,
  selectTownPlace,
} from "./adventure";
import { createInitialGameState } from "./createInitialGameState";
import { assertValidDungeonDefinition, type DungeonDefinition, type DungeonNodeDefinition } from "./dungeon";
import { createParty } from "./party";

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
    ["duplicate node", { ...initialDungeon, nodes: [...initialDungeon.nodes, initialDungeon.nodes[0]] }],
    ["duplicate edge", changedNode("entrance", { nextNodeIds: ["battle-a", "conversation-b", "battle-a"] })],
    ["self edge", changedNode("battle-a", { nextNodeIds: ["boss-c", "battle-a"] })],
    ["return to start", changedNode("battle-a", { nextNodeIds: ["boss-c", "entrance"] })],
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
    ],
    ["unreachable node", changedNode("entrance", { nextNodeIds: ["battle-a"] })],
    [
      "duplicate start",
      {
        ...initialDungeon,
        nodes: [
          ...initialDungeon.nodes.map((node) =>
            node.id === "entrance" ? { ...node, nextNodeIds: [...node.nextNodeIds, "other"] } : node,
          ),
          { id: "other", label: "other", type: "start", nextNodeIds: ["boss-c"] },
        ],
      },
    ],
    ["missing boss", changedNode("boss-c", { type: "battle" })],
    [
      "duplicate boss",
      {
        ...initialDungeon,
        nodes: [
          ...initialDungeon.nodes.map((node) =>
            node.id === "entrance" ? { ...node, nextNodeIds: [...node.nextNodeIds, "other"] } : node,
          ),
          { ...initialDungeon.nodes.find((node) => node.type === "boss"), id: "other" },
        ],
      },
    ],
    ["boss edge", changedNode("boss-c", { nextNodeIds: ["battle-a"] })],
    ["dead end", changedNode("battle-a", { nextNodeIds: [] })],
  ] as const)("dungeon rejects %s", (_name, definition) => {
    expect(() => assertValidDungeonDefinition(initialDungeon, initialAdventure, party)).not.toThrow();
    expect(() => assertValidDungeonDefinition(definition as DungeonDefinition, initialAdventure, party)).toThrow();
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
      const before = structuredClone(state);
      expect(getAvailableTownPlaces(state, definition)).toEqual([]);
      expect(selectTownPlace(state, "market", definition)).toEqual({
        accepted: false,
        reason: "place-unavailable",
        state: before,
      });
      expect(state).toEqual(before);
    }
    const state = { ...createInitialGameState(initialGameOptions), flags: ["a", "b"] };
    expect(getAvailableTownPlaces(state, definition).map((place) => place.id)).toContain("market");
    expect(selectTownPlace(state, "market", definition).accepted).toBe(true);
  });
  it.each(["missing default", "duplicate option", "empty options"])("adventure rejects %s", (kind) => {
    expect(() => assertValidAdventureDefinition(tinyAdventure)).not.toThrow();
    const definition: AdventureDefinition = {
      ...tinyAdventure,
      conversations: tinyAdventure.conversations.map((conversation) => ({
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
    expect(() => assertValidAdventureDefinition(definition)).toThrow();
  });
});

const tinyAdventure: AdventureDefinition = {
  places: [{ id: "place", label: "Place", routes: [{ conversationId: "story" }] }],
  conversations: [
    {
      id: "story",
      startNodeId: "line",
      onCompleteFlags: ["done"],
      nodes: {
        line: {
          type: "line",
          text: "Line",
          nextNodeId: "choice",
          backgroundId: "room",
          speakerName: "Guide",
          portraitId: "guide",
          position: "left",
        },
        choice: {
          type: "choice",
          prompt: "Choose",
          backgroundId: "room",
          speakerName: "Guide",
          portraitId: "guide",
          position: "left",
          options: [{ id: "yes", label: "Yes", nextNodeId: "end", setFlags: ["done"] }],
        },
        end: { type: "end", recruitments: [{ characterId: "player", setFlags: ["joined"] }] },
      },
    },
  ],
};
describe("adventure definition and transition boundaries", () => {
  it.each([
    ["blank place id", "places.0.id", ""],
    ["blank label", "places.0.label", ""],
    ["empty routes", "places.0.routes", []],
    ["fallback absent", "places.0.routes", [{ conversationId: "story", when: { all: ["a"] } }]],
    [
      "fallback first",
      "places.0.routes",
      [{ conversationId: "story" }, { conversationId: "story", when: { all: ["a"] } }],
    ],
    ["blank route reference", "places.0.routes.0.conversationId", ""],
    ["blank condition flag", "places.0.availableWhen", { none: [""] }],
    ["duplicate place", "places", [tinyAdventure.places[0], tinyAdventure.places[0]]],
    ["duplicate conversation", "conversations", [tinyAdventure.conversations[0], tinyAdventure.conversations[0]]],
    ["blank conversation id", "conversations.0.id", ""],
    ["missing start", "conversations.0.startNodeId", "missing"],
    ["end start", "conversations.0.startNodeId", "end"],
    ["blank start", "conversations.0.startNodeId", ""],
    ["blank completion flag", "conversations.0.onCompleteFlags", [""]],
    ["blank node id", "conversations.0.nodes", { ...tinyAdventure.conversations[0].nodes, "": { type: "end" } }],
    ["blank text", "conversations.0.nodes.line.text", ""],
    ["missing line target", "conversations.0.nodes.line.nextNodeId", "missing"],
    ["blank line target", "conversations.0.nodes.line.nextNodeId", ""],
    ["blank option id", "conversations.0.nodes.choice.options.0.id", ""],
    ["blank option label", "conversations.0.nodes.choice.options.0.label", ""],
    ["blank option target", "conversations.0.nodes.choice.options.0.nextNodeId", ""],
    ["blank choice flag", "conversations.0.nodes.choice.options.0.setFlags", [""]],
    ["blank recruitment character", "conversations.0.nodes.end.recruitments.0.characterId", ""],
    ["blank recruitment flag", "conversations.0.nodes.end.recruitments.0.setFlags", [""]],
    ["blank recruitment condition", "conversations.0.nodes.end.recruitments.0.when", { all: [""] }],
  ])("adventure schema rejects %s", (_label, path, value) => {
    const definition = JSON.parse(JSON.stringify(tinyAdventure));
    const fields = String(path).split(".");
    let target = definition;
    for (const key of fields.slice(0, -1)) target = target[key];
    target[fields.at(-1) ?? ""] = value;
    expect(() => assertValidAdventureDefinition(definition)).toThrow();
  });
  it("queries preserve complete input, wrong command kinds reject, and completion deduplicates flags", () => {
    const started = selectTownPlace(createInitialGameState(initialGameOptions), "place", tinyAdventure);
    expect(started.accepted).toBe(true);
    const before = structuredClone(started.state);
    expect(getCurrentConversationScene(started.state, tinyAdventure)).toMatchObject({
      type: "line",
      text: "Line",
      presentation: { backgroundId: "room", speakerName: "Guide", portraitId: "guide", position: "left" },
    });
    expect(started.state).toEqual(before);
    expect(chooseConversationOption(started.state, "yes", tinyAdventure)).toEqual({
      accepted: false,
      reason: "not-a-choice",
      state: before,
    });
    const choice = advanceConversation(started.state, tinyAdventure);
    expect(choice.accepted).toBe(true);
    const choiceBefore = structuredClone(choice.state);
    expect(getCurrentConversationScene(choice.state, tinyAdventure)).toMatchObject({
      type: "choice",
      prompt: "Choose",
      presentation: { backgroundId: "room", speakerName: "Guide", portraitId: "guide", position: "left" },
      options: [{ id: "yes", label: "Yes" }],
    });
    expect(choice.state).toEqual(choiceBefore);
    expect(advanceConversation(choice.state, tinyAdventure)).toEqual({
      accepted: false,
      reason: "not-a-line",
      state: choiceBefore,
    });
    const finished = chooseConversationOption(choice.state, "yes", tinyAdventure);
    expect(finished.state).toEqual({
      mode: "town",
      currentPlaceId: "place",
      conversationId: null,
      conversationPosition: null,
      flags: ["done"],
    });
    const revisited = selectTownPlace(finished.state, "place", tinyAdventure);
    const second = chooseConversationOption(
      advanceConversation(revisited.state, tinyAdventure).state,
      "yes",
      tinyAdventure,
    );
    expect(second.state).toEqual(finished.state);
  });
  it("first matching route wins and none excludes blocked routes", () => {
    const definition: AdventureDefinition = {
      ...tinyAdventure,
      places: [
        {
          id: "place",
          label: "Place",
          routes: [
            { conversationId: "first", when: { all: ["a"], none: ["blocked"] } },
            { conversationId: "second", when: { all: ["a"] } },
            { conversationId: "story" },
          ],
        },
      ],
      conversations: [
        ...tinyAdventure.conversations,
        ...["first", "second"].map((id) => ({ ...tinyAdventure.conversations[0], id })),
      ],
    };
    for (const [flags, conversationId] of [
      [[], "story"],
      [["a"], "first"],
      [["a", "blocked"], "second"],
    ] as const) {
      const result = selectTownPlace(
        { ...createInitialGameState(initialGameOptions), flags: [...flags] },
        "place",
        definition,
      );
      expect(result.accepted).toBe(true);
      expect(result.state.conversationId).toBe(conversationId);
    }
  });
});

describe("party definition input boundaries", () => {
  it.each([
    ["id", ""],
    ["name", ""],
    ["maxHp", 0],
    ["maxHp", Number.NaN],
    ["speed", 0],
    ["speed", Number.POSITIVE_INFINITY],
    ["attackPower", -1],
    ["attackPower", Number.NaN],
    ["hitRate", -0.1],
    ["hitRate", 1.1],
    ["hitRate", Number.NaN],
  ])("rejects invalid %s %s", (key, value) => {
    expect(() => createParty([{ ...characters[0], [key]: value }], [])).toThrow();
  });
  it("rejects duplicate definitions, duplicate joins and unknown joins", () => {
    expect(() => createParty([characters[0], characters[0]], [])).toThrow();
    expect(() => createParty(characters, ["player", "player"])).toThrow();
    expect(() => createParty(characters, ["missing"])).toThrow();
  });
});

describe("dungeon authored input boundaries", () => {
  it.each([
    ["blank dungeon", { ...initialDungeon, id: "" }],
    ["blank entry", { ...initialDungeon, entryNodeId: "" }],
    ["missing entry", { ...initialDungeon, entryNodeId: "missing" }],
    ["non-start entry", { ...initialDungeon, entryNodeId: "battle-a" }],
    ["empty route", { ...initialDungeon, nodes: [] }],
    ["blank node", changedNode("battle-a", { id: "" })],
    ["blank node label", changedNode("battle-a", { label: "" })],
    ["blank edge", changedNode("battle-a", { nextNodeIds: [""] })],
    ["unknown conversation", changedNode("conversation-b", { conversationId: "missing" })],
    ["empty enemies", changedNode("battle-a", { enemies: [] })],
    ["ally as enemy", changedNode("battle-a", { enemies: [party[0]] })],
  ])("dungeon schema rejects %s", (_label, definition) => {
    expect(() => assertValidDungeonDefinition(definition as DungeonDefinition, initialAdventure, party)).toThrow();
  });
  it("rejects empty or enemy-only expedition party", () => {
    for (const invalid of [[], [{ ...party[0], team: "enemy" as const }]])
      expect(() => assertValidDungeonDefinition(initialDungeon, initialAdventure, invalid)).toThrow();
  });
});
