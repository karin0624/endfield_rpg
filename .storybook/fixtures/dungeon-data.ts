import { characters } from "../../src/content/characters";
import { rewardGrowth } from "../../src/game/growthRuntime";
import { campaignRules } from "../../src/presentation/campaignModel";
import type { DungeonModel } from "../../src/presentation/dungeonModel";
import { reduceDungeon } from "../../src/presentation/dungeonModel";
import { projectDungeonChrome } from "../../src/presentation/dungeonProjection";
import { type GrowthFrame, projectGrowthChoice } from "../../src/presentation/growthProjection";
import { dungeonPicture } from "../../tests/dungeonPictures";

type DungeonStoryOptions = {
  panel?: "actor" | "skill" | "target" | "item";
  empty?: "actors" | "skills";
  injured?: boolean;
  itemCount?: number;
  mode?: "conversation" | "growth" | "outcome";
  type?: "line" | "choice";
  outcome?: "failed" | "cleared";
  guaranteed?: string;
  error?: string;
};

export function growthFrame(options: Pick<DungeonStoryOptions, "guaranteed" | "error"> = {}): GrowthFrame {
  const { input } = dungeonPicture();
  const reward = rewardGrowth(input.game, { allocations: [{ characterId: "player", experience: 10 }] }, campaignRules);
  if (!reward.accepted || !reward.state.growth) throw new Error("The growth story needs a confirmed offer");
  const frame = projectGrowthChoice(
    reward.state.growth,
    campaignRules.catalog,
    Object.fromEntries(characters.map(({ id, name }) => [id, name])),
  );
  if (!frame) throw new Error("The growth story needs a pending choice");
  return {
    ...frame,
    ...(options.guaranteed !== undefined ? { guaranteed: options.guaranteed } : {}),
    ...(options.error !== undefined ? { error: options.error } : {}),
  };
}

export function dungeonFrame(options: DungeonStoryOptions = {}) {
  let { state, input } = dungeonPicture();
  if (options.mode === "conversation") {
    const entered = reduceDungeon(state, input, { type: "enter", nodeId: "conversation-b" });
    if (!entered.handled) throw new Error("The dungeon conversation is unavailable");
    state = entered.state;
    input = { ...input, game: entered.game };
    if (options.type === "choice") {
      const advanced = reduceDungeon(state, input, { type: "advance" });
      if (!advanced.handled) throw new Error("The dungeon choice is unavailable");
      state = advanced.state;
      input = { ...input, game: advanced.game };
    }
  }
  const panel = options.panel;
  if (panel) {
    const branchPanel =
      panel === "actor"
        ? { kind: "actor" as const }
        : panel === "skill"
          ? { kind: "skill" as const, actorId: "player" }
          : panel === "target"
            ? { kind: "target" as const, actorId: "player", skillId: "test-heal" }
            : { kind: "item" as const, targetId: "player" };
    state = { ...state, context: { ...state.context, branch: { panel: branchPanel, focus: null } } };
  }
  if (options.injured || options.empty) {
    input = {
      ...input,
      game: {
        ...input.game,
        dungeon: input.game.dungeon
          ? {
              ...input.game.dungeon,
              party: input.game.dungeon.party.map((member) => ({
                ...member,
                hp: options.empty === "actors" ? 0 : options.injured ? Math.max(1, member.hp - 8) : member.hp,
                learnedSkills: options.empty === "skills" ? [] : member.learnedSkills,
              })),
            }
          : null,
      },
    };
  }
  if (options.itemCount === 0 && input.game.inventory?.items.exploration) {
    input = {
      ...input,
      game: {
        ...input.game,
        inventory: {
          ...input.game.inventory,
          items: {
            ...input.game.inventory.items,
            exploration: { ...input.game.inventory.items.exploration, bag: [] },
          },
        },
      },
    };
  }
  if (options.mode === "outcome") {
    state = {
      ...state,
      value: "outcome",
      context: { ...state.context, outcome: options.outcome ?? "cleared" },
    } as DungeonModel;
  }
  if (options.mode === "growth") {
    const reward = rewardGrowth(
      input.game,
      { allocations: [{ characterId: "player", experience: 10 }] },
      campaignRules,
    );
    if (!reward.accepted) throw new Error("The growth reward was not accepted");
    state = { ...state, value: "growth" } as DungeonModel;
    input = { ...input, game: reward.state };
  }
  const frame = projectDungeonChrome(state, input, "ホームへ帰還");
  return options.mode === "growth"
    ? { ...frame, growth: growthFrame({ guaranteed: options.guaranteed, error: options.error }) }
    : frame;
}

export function routeNode(
  type: "battle" | "conversation" | "boss",
  state: "available" | "current" | "unreachable" | "past",
) {
  const base = dungeonFrame().route.nodes.find((node) => node.type === type);
  if (!base) throw new Error(`Unknown route node: ${type}`);
  const enabled = state === "available";
  return {
    ...base,
    title: state === "past" ? null : base.title,
    enabled,
    current: state === "current",
    resolved: false,
    past: state === "past",
    icon: `dungeon-nodes/${enabled ? "focus" : "unfocus"}/${type === "conversation" ? "encounter" : type}.png`,
  };
}
