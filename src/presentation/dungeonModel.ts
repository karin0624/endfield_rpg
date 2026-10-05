import { characters } from "../content/characters";
import type { AdventureDefinition } from "../game/adventure";
import type { BattleCombatantDefinition, BattleEvent, BattleSkillRules, BattleState } from "../game/battle";
import {
  type DungeonActionResult,
  type DungeonDefinition,
  getAvailableDungeonNodes,
  getCurrentDungeonConversationScene,
} from "../game/dungeon";
import {
  actInExpedition,
  type DungeonCommand,
  type ExpeditionGame,
  type GameActionCompletion,
} from "../game/expedition";
import { chooseGrowthSkill, hasPendingGrowth } from "../game/growthRuntime";
import { adventureKeyCommand, type InputContext } from "./adventureModel";
import {
  type BattleInput,
  type BattleModel,
  type BattleModelEvent,
  confirmBattleAction,
  createBattleModel,
  reduceBattleModel,
} from "./battleModel";
import type { ConfirmedBattleEvent, ConfirmedBattleRecord } from "./battlePlayback";
import {
  type BranchFocus,
  type BranchRecoveryEvent,
  type BranchRecoveryModel,
  branchFocusOrder,
  branchItemCount,
  createBranchRecovery,
  reduceBranchRecovery,
} from "./branchRecoveryModel";
import { createDungeonRoute, type DungeonRoutePresentation, type RouteEvent, reduceDungeonRoute } from "./dungeonRoute";
import { type GrowthEvent, type GrowthFocus, reduceGrowthPresentation } from "./growthModel";
import { formatAmount } from "./statusText";

export interface DungeonInput {
  readonly game: ExpeditionGame;
  readonly route: DungeonDefinition;
  readonly adventure: AdventureDefinition;
  readonly rules?: BattleSkillRules;
  readonly basicAttack: boolean;
  readonly items: boolean;
  readonly enemyDepths: BattleInput["enemyDepths"];
}
export type DungeonFocus =
  | { readonly kind: "return" | "route" }
  | { readonly kind: "node" | "choice"; readonly id: string }
  | { readonly kind: "branch"; readonly target: BranchFocus };
export interface DungeonModel {
  readonly screen:
    | { readonly kind: "route" | "conversation" | "growth" | "closed" }
    | { readonly kind: "battle"; readonly nodeId: string; readonly battle: BattleModel }
    | { readonly kind: "outcome"; readonly outcome: "cleared" | "failed" };
  readonly route: DungeonRoutePresentation;
  readonly branch: BranchRecoveryModel;
  readonly focus: DungeonFocus | null;
  readonly growthFocus: GrowthFocus;
  readonly inputContext: InputContext;
  readonly message: string;
  readonly branchResult: string;
  /** Counts real scene replacements within this screen, not accepted inputs. */
  readonly sceneOwner: number;
  readonly speed: 0 | 1 | 2;
  readonly reducedMotion: boolean;
}
export type DungeonEvent =
  | { readonly type: "motion"; readonly reduced: boolean }
  | { readonly type: "enter"; readonly nodeId: string }
  | { readonly type: "advance" }
  | { readonly type: "return" | "closed" }
  | { readonly type: "choose"; readonly optionId: string }
  | { readonly type: "key"; readonly key: string; readonly code: string; readonly shift: boolean }
  | { readonly type: "input-context"; readonly context: InputContext }
  | { readonly type: "focused"; readonly target: DungeonFocus }
  | { readonly type: "route"; readonly event: RouteEvent }
  | { readonly type: "branch"; readonly event: BranchRecoveryEvent }
  | { readonly type: "battle"; readonly event: BattleModelEvent }
  | { readonly type: "growth"; readonly event: GrowthEvent };
export type DungeonEffect =
  | { readonly type: "open-scene"; readonly owner: number }
  | { readonly type: "close-scene"; readonly releaseRenderer?: true }
  | { readonly type: "capture-pointer"; readonly pointerId: number };
export interface DungeonTransition {
  readonly state: DungeonModel;
  readonly game: ExpeditionGame;
  readonly effects: readonly DungeonEffect[];
  readonly handled: boolean;
  readonly returnRequested?: true;
  readonly result?: DungeonActionResult;
  readonly completion?: GameActionCompletion;
}
function currentScreen(input: DungeonInput): DungeonModel["screen"] {
  if (hasPendingGrowth(input.game)) return { kind: "growth" };
  const dungeon = input.game.dungeon;
  if (!dungeon) return { kind: "closed" };
  if (dungeon.outcome !== "ongoing") return { kind: "outcome", outcome: dungeon.outcome };
  return { kind: dungeon.activity?.type === "conversation" ? "conversation" : "route" };
}
export function createDungeonModel(input: DungeonInput, reducedMotion = false): DungeonModel {
  return {
    screen: currentScreen(input),
    route: createDungeonRoute(),
    branch: createBranchRecovery(),
    focus: null,
    growthFocus: hasPendingGrowth(input.game) ? { kind: "heading" } : null,
    inputContext: "screen",
    message: "",
    branchResult: "",
    sceneOwner: 0,
    speed: 1,
    reducedMotion,
  };
}
export function dungeonAccessibleIds(input: DungeonInput): readonly string[] {
  return input.game.dungeon
    ? [
        input.game.dungeon.currentNodeId,
        ...getAvailableDungeonNodes(input.game.dungeon, input.route).map(({ id }) => id),
      ]
    : [];
}
export function dungeonBattleInput(input: DungeonInput): BattleInput {
  return {
    battle: input.game.dungeon?.activity?.type === "battle" ? input.game.dungeon.activity.state : null,
    rules: input.rules,
    basicAttack: input.basicAttack,
    items: input.items,
    itemCount: branchItemCount(input),
    enemyDepths: input.enemyDepths,
  };
}
function routeFocusOrder(state: DungeonModel, input: DungeonInput): readonly DungeonFocus[] {
  return [
    { kind: "return" },
    { kind: "route" },
    ...(input.game.dungeon
      ? getAvailableDungeonNodes(input.game.dungeon, input.route).map(({ id }) => ({ kind: "node" as const, id }))
      : []),
    ...branchFocusOrder(state.branch, input).map((target) => ({ kind: "branch" as const, target })),
  ];
}
function branchSummary(result: Extract<DungeonActionResult, { accepted: true }>): string {
  if (result.itemRecovery) {
    const event = result.itemRecovery,
      target = result.state.party.find(({ id }) => id === event.targetId) as BattleCombatantDefinition;
    const name = characters.find(({ id }) => id === target.id)?.name ?? target.id;
    return `HP回復品：HPを${event.amount}回復。${name} HP ${target.hp} · 精神疲労 ${target.mentalFatigue ?? 0}。`;
  }
  // A successful branch skill publishes its recovery and one cost before optional onset records.
  const used = result.events.find((event) => event.type === "skill") as Extract<BattleEvent, { type: "skill" }>,
    cost = result.events.find((event) => event.type === "skill-cost") as Extract<BattleEvent, { type: "skill-cost" }>;
  let text = `HPを${formatAmount(used.amount)}回復。精神疲労 ${cost.fatigueBefore} → ${cost.fatigueAfter}。`;
  for (const event of result.events)
    if (event.type === "symptom")
      text += `${event.kind === "physicalFatigue" ? "肉体疲労" : "朦朧"} ${event.before} → ${event.after}。`;
  return text;
}
export function reduceDungeon(state: DungeonModel, input: DungeonInput, event: DungeonEvent): DungeonTransition {
  const result = (
    next = state,
    game = input.game,
    effects: readonly DungeonEffect[] = [],
    handled = true,
  ): DungeonTransition => ({ state: next, game, effects, handled });
  const ignored = () => result(state, input.game, [], false);
  if (state.screen.kind === "closed") return ignored();
  if (event.type === "closed")
    return result(
      { ...state, screen: { kind: "closed" }, focus: null, growthFocus: null, inputContext: "screen" },
      input.game,
      state.screen.kind === "battle" ? [{ type: "close-scene" }] : [],
    );
  if (event.type === "motion")
    return state.screen.kind === "battle"
      ? reduceDungeon(state, input, {
          type: "battle",
          event: { type: "playback", event: { type: "motion", reduced: event.reduced } },
        })
      : result({ ...state, reducedMotion: event.reduced });
  if (event.type === "input-context")
    return event.context === state.inputContext
      ? ignored()
      : result({
          ...state,
          inputContext: event.context,
          ...(event.context === "screen" ? { focus: null, branch: { ...state.branch, focus: null } } : {}),
        });
  if (event.type === "focused") {
    const target = event.target;
    const valid =
      state.screen.kind === "route"
        ? state.branch.panel.kind === "closed" &&
          routeFocusOrder(state, input).some((focus) => JSON.stringify(focus) === JSON.stringify(target))
        : state.screen.kind === "outcome"
          ? target.kind === "return"
          : state.screen.kind === "conversation" &&
              target.kind === "choice" &&
              input.game.dungeon?.activity?.type === "conversation"
            ? getCurrentDungeonConversationScene(input.game.dungeon, input.adventure)?.type === "choice"
            : false;
    return valid
      ? result({ ...state, focus: target, branch: { ...state.branch, focus: null }, inputContext: "control" })
      : ignored();
  }
  if (event.type === "return")
    return (state.screen.kind === "route" && state.branch.panel.kind === "closed") || state.screen.kind === "outcome"
      ? { ...result(), returnRequested: true }
      : ignored();
  if (event.type === "route" && state.screen.kind === "route" && state.branch.panel.kind === "closed") {
    if (event.event.type === "pan-key" && state.focus?.kind !== "route") return ignored();
    const changed = reduceDungeonRoute(state.route, event.event, dungeonAccessibleIds(input));
    return result(
      changed.state === state.route ? state : { ...state, route: changed.state },
      input.game,
      changed.capture === undefined ? [] : [{ type: "capture-pointer", pointerId: changed.capture }],
      changed.handled,
    );
  }
  if (state.screen.kind === "growth") {
    if (event.type !== "growth" || !input.rules) return ignored();
    if (event.event.type !== "choose") {
      const changed = reduceGrowthPresentation(state.growthFocus, event.event, input.game.growth?.choice ?? null);
      return result({ ...state, growthFocus: changed.focus }, input.game, [], changed.handled);
    }
    const changed = chooseGrowthSkill(input.game, event.event.skillId, input.rules);
    return changed.accepted
      ? result(
          {
            ...state,
            screen: currentScreen({ ...input, game: changed.state }),
            growthFocus: hasPendingGrowth(changed.state) ? { kind: "heading" } : null,
            route: { ...state.route, panned: false },
            focus: null,
          },
          changed.state,
        )
      : ignored();
  }
  if (state.screen.kind === "battle") {
    if (event.type !== "battle") return ignored();
    const before = state.screen.battle;
    const changed = reduceBattleModel(before, dungeonBattleInput(input), event.event);
    let next: DungeonModel =
      changed.state === before
        ? state
        : {
            ...state,
            screen: { ...state.screen, battle: changed.state },
            speed: changed.state.playback.requestedSpeed,
            reducedMotion: changed.state.playback.reducedMotion,
          };
    if (changed.focusExit)
      next = { ...next, screen: { ...state.screen, battle: { ...changed.state, focus: null } }, focus: null };
    if (!changed.command)
      return result(
        next,
        input.game,
        event.event.type === "scene-error" && changed.handled ? [{ type: "close-scene", releaseRenderer: true }] : [],
        changed.focusExit ? false : changed.handled,
      );
    if (changed.command.type === "finish") {
      const screen = currentScreen(input);
      // Failure has already committed return healing/calendar in the core. Its display never restores that game.
      if (!input.game.dungeon)
        return {
          ...result({ ...next, screen: { kind: "closed" }, focus: null }, input.game, [{ type: "close-scene" }]),
          returnRequested: true,
        };
      return result(
        {
          ...next,
          screen,
          focus: null,
          growthFocus: screen.kind === "growth" ? { kind: "heading" } : null,
          route: { ...state.route, panned: false },
          inputContext: "screen",
        },
        input.game,
        [{ type: "close-scene" }],
      );
    }
    const command: DungeonCommand = changed.command;
    const committed = actInExpedition(input.game, command, input.route, input.adventure, input.rules);
    // Accepted attack/skill/item operations publish a battle result, including a completed node.
    const battle = committed.result.accepted ? (committed.result.battleState as BattleState) : undefined;
    const events: readonly ConfirmedBattleEvent[] =
      committed.result.accepted && committed.result.itemRecovery && command.type === "item"
        ? [{ ...committed.result.itemRecovery, actorId: command.actorId }, ...committed.result.events]
        : committed.result.events;
    next = {
      ...next,
      screen: {
        ...state.screen,
        battle: confirmBattleAction(
          changed.state,
          dungeonBattleInput({ ...input, game: committed.state }),
          committed.result.accepted
            ? {
                accepted: true,
                record: {
                  before: dungeonBattleInput(input).battle as BattleState,
                  after: battle as BattleState,
                  events,
                },
              }
            : committed.result,
        ),
      },
    };
    return {
      ...result(next, committed.state, [], committed.result.accepted),
      result: committed.result,
      completion: committed.completion,
    };
  }
  let command: DungeonCommand | undefined;
  let next = state;
  if (state.screen.kind === "route" && event.type === "branch") {
    const changed = reduceBranchRecovery(state.branch, input, event.event);
    if (!changed.handled) return ignored();
    next = {
      ...state,
      branch: changed.state,
      focus:
        changed.state.panel.kind === "closed" && changed.state.focus
          ? { kind: "branch", target: changed.state.focus }
          : null,
      inputContext: changed.state.panel.kind === "closed" ? "control" : "text-entry",
    };
    if (!changed.command) return result(next, input.game, [], changed.handled);
    command = changed.command;
  } else if (state.screen.kind === "route" && state.branch.panel.kind !== "closed") return ignored();
  else if (event.type === "key") {
    if (state.screen.kind === "conversation") {
      const activity = input.game.dungeon?.activity;
      if (activity?.type !== "conversation") return ignored();
      const mapped = adventureKeyCommand(activity.state, input.adventure, state.inputContext, event.code);
      if (!mapped || mapped.type === "select") return ignored();
      command = mapped;
    } else if (state.screen.kind === "route" && event.key === "Tab") {
      const order = routeFocusOrder(state, input),
        index = order.findIndex((target) => JSON.stringify(target) === JSON.stringify(state.focus));
      const position = index < 0 ? (event.shift ? order.length - 1 : 0) : index + (event.shift ? -1 : 1);
      return result(
        { ...state, focus: order[position] ?? null, branch: { ...state.branch, focus: null } },
        input.game,
        [],
        position >= 0 && position < order.length,
      );
    } else return ignored();
  } else if (event.type === "enter" && state.screen.kind === "route") command = event;
  else if ((event.type === "advance" || event.type === "choose") && state.screen.kind === "conversation")
    command = event;
  if (!command) return ignored();
  const committed = actInExpedition(input.game, command, input.route, input.adventure, input.rules);
  if (!committed.result.accepted)
    return {
      ...result({ ...next, message: `操作できませんでした: ${committed.result.reason}` }, input.game, [], false),
      result: committed.result,
    };
  const coreResult = committed.result;
  if (command.type === "enter" && coreResult.battleBefore && coreResult.battleState) {
    const owner = state.sceneOwner + 1;
    const record: ConfirmedBattleRecord = {
      before: coreResult.battleBefore,
      after: coreResult.battleState,
      events: coreResult.events,
    };
    return {
      ...result(
        {
          ...next,
          screen: {
            kind: "battle",
            nodeId: command.nodeId,
            battle: createBattleModel(record, owner, state.speed, state.reducedMotion),
          },
          sceneOwner: owner,
          branch: { ...state.branch, focus: null },
          focus: null,
          message: "",
          inputContext: "screen",
        },
        committed.state,
        [{ type: "open-scene", owner }],
      ),
      result: coreResult,
      completion: committed.completion,
    };
  }
  const screen = currentScreen({ ...input, game: committed.state });
  const branch =
    command.type === "branch-skill" || command.type === "branch-item"
      ? {
          panel: { kind: "closed" as const },
          focus:
            command.type === "branch-item" && branchItemCount({ ...input, game: committed.state }) === 0
              ? null
              : { kind: command.type === "branch-item" ? ("item-trigger" as const) : ("skill-trigger" as const) },
        }
      : { ...next.branch, focus: null };
  const focus =
    command.type === "branch-item" && !branch.focus
      ? getAvailableDungeonNodes(coreResult.state, input.route)[0]?.id
      : undefined;
  return {
    ...result(
      {
        ...next,
        screen,
        branch,
        route: { ...state.route, panned: false },
        focus: branch.focus
          ? { kind: "branch", target: branch.focus }
          : command.type === "branch-item"
            ? focus
              ? { kind: "node", id: focus }
              : { kind: "return" }
            : null,
        growthFocus: screen.kind === "growth" ? { kind: "heading" } : null,
        message: "",
        inputContext: "screen",
        branchResult:
          command.type === "branch-skill" || command.type === "branch-item"
            ? branchSummary(coreResult)
            : state.branchResult,
      },
      committed.state,
    ),
    result: coreResult,
    completion: committed.completion,
  };
}
