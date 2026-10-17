import { mount, tick } from "svelte";
import { characters } from "../../src/content/characters";
import { rewardGrowth } from "../../src/game/growthRuntime";
import { campaignRules } from "../../src/presentation/campaignModel";
import {
  type DungeonEvent,
  type DungeonInput,
  type DungeonModel,
  reduceDungeon,
} from "../../src/presentation/dungeonModel";
import type { DungeonChromeFrame } from "../../src/presentation/dungeonProjection";
import { projectDungeon, projectDungeonChrome } from "../../src/presentation/dungeonProjection";
import { type GrowthFrame, projectGrowthChoice } from "../../src/presentation/growthProjection";
import GrowthChoice from "../../src/web/components/GrowthChoice.svelte";
import { createDungeonView } from "../../src/web/dungeonView.svelte.ts";
import { dungeonPicture } from "../dungeonPictures";
import { isolateDesignComponent } from "./design-isolation";
import type { DesignCase } from "./design-view";

const text = (props: Record<string, unknown>, key: string, fallback: string) => String(props[key] ?? fallback);

function picture(props: Record<string, unknown>): { state: DungeonModel; input: DungeonInput } {
  const base = dungeonPicture("items");
  let state = base.state;
  let input = base.input;
  if (props.progressed) {
    for (const event of [
      { type: "enter", nodeId: "conversation-b" },
      { type: "advance" },
      { type: "choose", optionId: "mark-on-map" },
    ] as const) {
      const changed = reduceDungeon(state, input, event);
      if (!changed.handled) throw new Error(`Unavailable dungeon design input: ${event.type}`);
      state = changed.state;
      input = { ...input, game: changed.game };
    }
    while (state.value === "growth") {
      const choice = input.game.growth?.choice?.candidateIds[0];
      if (!choice) throw new Error("The growth design picture has no offered candidate");
      const changed = reduceDungeon(state, input, { type: "growth", event: { type: "choose", skillId: choice } });
      if (!changed.handled) throw new Error("The offered growth choice was not accepted");
      state = changed.state;
      input = { ...input, game: changed.game };
    }
  }
  if (props.mode === "conversation") {
    const entered = reduceDungeon(state, input, { type: "enter", nodeId: "conversation-b" });
    if (!entered.handled) throw new Error("The dungeon conversation is unavailable");
    state = entered.state;
    input = { ...input, game: entered.game };
    if (props.type === "choice") {
      const advanced = reduceDungeon(state, input, { type: "advance" });
      if (!advanced.handled) throw new Error("The dungeon conversation choice is unavailable");
      state = advanced.state;
      input = { ...input, game: advanced.game };
    }
  }
  return { state, input };
}

function branchState(state: DungeonModel, props: Record<string, unknown>): DungeonModel {
  const panel = text(props, "panel", "actor");
  const actorId = text(props, "actorId", "player");
  const branchPanel =
    panel === "actor"
      ? { kind: "actor" as const }
      : panel === "skill"
        ? { kind: "skill" as const, actorId }
        : panel === "target"
          ? { kind: "target" as const, actorId, skillId: text(props, "skillId", "test-heal") }
          : panel === "item"
            ? { kind: "item" as const, targetId: text(props, "itemTargetId", "player") }
            : { kind: "closed" as const };
  return { ...state, context: { ...state.context, branch: { panel: branchPanel, focus: null } } };
}

const parts: Record<string, string> = {
  node: ".dungeon-route-node",
  edge: ".dungeon-route-edge",
  calendar: ".dungeon-calendar",
  return: ".dungeon-town-link",
  viewport: ".dungeon-route-viewport",
  "skill-trigger": ".branch-skill-trigger",
  "item-trigger": ".item-trigger",
  "branch-result": ".branch-skill-result",
  "branch-button": ".branch-skill-dialog [data-branch-focus]:not([data-branch-focus='cancel'])",
  "branch-cancel": ".branch-skill-dialog [data-branch-focus='cancel']",
  "item-target": "[data-item-target]",
  "item-use": "[data-item-use]",
  "item-cancel": "[data-item-cancel]",
};

async function render(root: HTMLElement, props: Record<string, unknown>, only?: string) {
  if (!(root instanceof HTMLDivElement)) throw new Error("Dungeon design root must be a div");
  let { state, input } = picture(props);
  if (only === "branch" || props.panel) state = branchState(state, props);
  if (props.branchResult !== undefined)
    state = { ...state, context: { ...state.context, branchResult: String(props.branchResult) } };
  if (props.injured || props.empty)
    input = {
      ...input,
      game: {
        ...input.game,
        dungeon: input.game.dungeon
          ? {
              ...input.game.dungeon,
              party: input.game.dungeon.party.map((member) => ({
                ...member,
                hp: props.empty === "actors" ? 0 : props.injured ? Math.max(1, member.hp - 8) : member.hp,
                learnedSkills: props.empty === "skills" ? [] : member.learnedSkills,
              })),
            }
          : null,
      },
    };
  if (props.itemCount === 0 && input.game.inventory?.items.exploration)
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
  const project = () => {
    const frame = projectDungeon(state, input, "ホームへ帰還");
    if (only === "node") {
      const type = text(props, "type", "battle");
      const found = frame.route.nodes.find((node) => node.type === type);
      if (!found) throw new Error(`Unknown route node type: ${type}`);
      const status = text(props, "state", "available");
      const enabled = status === "available";
      return {
        ...frame,
        route: {
          ...frame.route,
          edges: [],
          nodes: [
            {
              ...found,
              title: status === "past" ? null : found.title,
              enabled,
              current: status === "current",
              resolved: status === "resolved",
              past: status === "past",
              icon: `dungeon-nodes/${enabled ? "focus" : "unfocus"}/${type === "conversation" ? "encounter" : type}.png`,
            },
          ],
        },
      };
    }
    if (only === "edge")
      return {
        ...frame,
        route: {
          ...frame.route,
          edges: frame.route.edges
            .filter((edge) => edge.from === text(props, "from", "battle-a") && edge.to === "boss-c")
            .map((edge) => ({ ...edge, appearance: text(props, "appearance", "available") })),
        },
      };
    return frame;
  };
  const dispatch = (event: DungeonEvent) => {
    const changed = reduceDungeon(state, input, event);
    if (changed.state !== state) {
      state = changed.state;
      input = { ...input, game: changed.game };
      view.render(project());
    }
    return changed.handled;
  };
  const view = createDungeonView(root, dispatch, "ホームへ帰還");
  view.render(project());
  await tick();
  if (only) {
    // Only the real host is sized; the component's own geometry/CSS is retained.
    const host = root.querySelector<HTMLElement>(".dungeon-app");
    if (!host) throw new Error("The dungeon source host is required");
    Object.assign(host.style, {
      position: "absolute",
      width: "1800px",
      height: "1080px",
      left: "64px",
      top: "64px",
      right: "auto",
      bottom: "auto",
      overflow: "visible",
    });
    for (const element of root.querySelectorAll<HTMLElement>(".dungeon-route-screen"))
      element.style.overflow = "visible";
    if (only !== "viewport")
      for (const element of root.querySelectorAll<HTMLElement>(".dungeon-route-viewport"))
        element.style.overflow = "visible";
    isolateDesignComponent(
      root,
      only === "branch" ? (props.panel === "item" ? ".item-dialog" : ".branch-skill-dialog") : parts[only],
    );
  }
  if (props.pan || props.dragging) {
    await document.fonts.ready;
    await Promise.all([...root.querySelectorAll("img")].map((image) => image.decode()));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const measure = state.context.route.measure;
    if (!measure?.nodes.length) throw new Error("Pan design states require a measured route");
    if (!dispatch({ type: "focused", target: { kind: "route" } }))
      throw new Error("The route cannot receive pan input");
    if (props.pan) {
      if (props.pan !== "left" && props.pan !== "right") throw new Error("Unknown route pan boundary");
      const centers = measure.nodes.map((node) => node.center);
      const steps = Math.ceil((Math.max(...centers) - Math.min(...centers)) / 48) + 1;
      for (let step = 0; step < steps; step++)
        dispatch({ type: "route", event: { type: "pan-key", key: props.pan === "left" ? "ArrowLeft" : "ArrowRight" } });
    }
    if (props.dragging) {
      dispatch({ type: "route", event: { type: "pointer-down", pointerId: 42, x: 0, button: 0 } });
      dispatch({ type: "route", event: { type: "pointer-move", pointerId: 42, x: 4 } });
    }
    await tick();
  }
}

function growth(props: Record<string, unknown>): GrowthFrame {
  const { input } = dungeonPicture("items");
  const reward = rewardGrowth(input.game, { allocations: [{ characterId: "player", experience: 10 }] }, campaignRules);
  if (!reward.accepted || !reward.state.growth) throw new Error("The growth picture needs a confirmed offer");
  const projected = projectGrowthChoice(
    reward.state.growth,
    campaignRules.catalog,
    Object.fromEntries(characters.map(({ id, name }) => [id, name])),
  );
  if (!projected) throw new Error("The growth picture needs a pending choice");
  return {
    ...projected,
    title: text(props, "title", projected.title),
    summary: text(props, "summary", projected.summary),
    guaranteed: text(props, "guaranteed", projected.guaranteed),
    error: text(props, "error", projected.error),
    candidates: Array.isArray(props.candidates)
      ? (props.candidates as GrowthFrame["candidates"])
      : projected.candidates,
  };
}

export const cases: Record<string, DesignCase> = {
  route(root, props) {
    return render(root, props);
  },
  node(root, props) {
    return render(root, props, "node");
  },
  branch(root, props) {
    return render(root, props, "branch");
  },
  component(root, props) {
    const part = text(props, "part", "calendar");
    if (!parts[part]) throw new Error(`Unknown dungeon component: ${part}`);
    return render(root, props, part);
  },
  conversation(root, props) {
    return render(root, { ...props, mode: "conversation" });
  },
  async growth(root, props) {
    if (!(root instanceof HTMLDivElement)) throw new Error("Dungeon design root must be a div");
    const base = picture(props);
    const reward = rewardGrowth(
      base.input.game,
      { allocations: [{ characterId: "player", experience: 10 }] },
      campaignRules,
    );
    if (!reward.accepted) throw new Error("The growth reward was not accepted");
    const chrome = projectDungeonChrome(
      { value: "growth", context: base.state.context },
      { ...base.input, game: reward.state },
      "ホームへ帰還",
    );
    createDungeonView(root, () => false, "ホームへ帰還").render({ ...chrome, growth: growth(props), battle: null });
    await tick();
  },
  async "growth-candidate"(root, props) {
    const projected = growth(props);
    const candidate = projected.candidates.find((entry) => entry.skillId === props.skillId) ?? projected.candidates[0];
    if (!candidate) throw new Error("A growth candidate is required");
    const frame = {
      ...projected,
      candidates: [
        {
          ...candidate,
          name: text(props, "name", candidate.name),
          detail: text(props, "detail", candidate.detail),
          description: text(props, "description", candidate.description),
        },
      ],
    };
    mount(GrowthChoice, { target: root, props: { frame, focus: null, send: () => false } });
    await tick();
    isolateDesignComponent(root, ".growth-choice button");
  },
  async outcome(root, props) {
    if (!(root instanceof HTMLDivElement)) throw new Error("Dungeon design root must be a div");
    const base = picture(props);
    const chrome = projectDungeonChrome(
      {
        value: "outcome",
        context: { ...base.state.context, outcome: props.outcome === "failed" ? "failed" : "cleared" },
      },
      base.input,
      "ホームへ帰還",
    );
    const frame: DungeonChromeFrame = { ...chrome, focus: null };
    createDungeonView(root, () => false, "ホームへ帰還").render({ ...frame, battle: null });
    await tick();
    if (props.part === "return") isolateDesignComponent(root, ".dungeon-outcome-return");
  },
};
