import { assign, enqueueActions, initialTransition, type SnapshotFrom, setup, transition } from "xstate";
import { characters } from "../content/characters";
import type { AdventureDefinition } from "../game/adventure";
import type { BattleCombatantDefinition, BattleEvent, BattleSkillRules } from "../game/battle";
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
export interface DungeonContext {
  readonly battle: BattleModel | null;
  readonly outcome: "cleared" | "failed" | null;
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
interface DungeonOutput {
  readonly game: ExpeditionGame;
  readonly effects: readonly DungeonEffect[];
  readonly handled: boolean;
  readonly returnRequested?: true;
  readonly result?: DungeonActionResult;
  readonly completion?: GameActionCompletion;
}
export interface DungeonTransition extends DungeonOutput {
  readonly state: DungeonModel;
}
function initialContext(reducedMotion: boolean): DungeonContext {
  return {
    battle: null,
    outcome: null,
    route: createDungeonRoute(),
    branch: createBranchRecovery(),
    focus: null,
    growthFocus: null,
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
function routeFocusOrder(state: DungeonContext, input: DungeonInput): readonly DungeonFocus[] {
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
type MachineEvent =
  | (DungeonEvent & { readonly input: DungeonInput })
  | { readonly type: "resume"; readonly input: DungeonInput }
  | { readonly type: "commit"; readonly input: DungeonInput; readonly command: DungeonCommand }
  | { readonly type: "battle-started" };
const flow = setup<
  DungeonContext,
  MachineEvent,
  Record<never, never>,
  Record<never, never>,
  { output: DungeonOutput },
  Record<never, never>,
  never,
  string,
  { reducedMotion: boolean }
>({});
const battleEvent = flow.enqueueActions(({ context, event, enqueue }) => {
  if ((event.type !== "battle" && event.type !== "motion") || !context.battle) return;
  const input = event.input;
  const battleEvent: BattleModelEvent =
    event.type === "motion" ? { type: "playback", event: { type: "motion", reduced: event.reduced } } : event.event;
  const before = context.battle,
    changed = reduceBattleModel(before, dungeonBattleInput(input), battleEvent);
  if (changed.state !== before || changed.focusExit)
    enqueue.assign({
      battle: changed.focusExit ? { ...changed.state, focus: null } : changed.state,
      speed: changed.state.playback.requestedSpeed,
      reducedMotion: changed.state.playback.reducedMotion,
      ...(changed.focusExit ? { focus: null } : {}),
    });
  if (!changed.command) {
    enqueue({
      type: "output",
      params: {
        game: input.game,
        effects:
          battleEvent.type === "scene-error" && changed.handled ? [{ type: "close-scene", releaseRenderer: true }] : [],
        handled: changed.focusExit ? false : changed.handled,
      },
    });
    return;
  }
  if (changed.command.type === "finish") {
    enqueue.assign({
      battle: null,
      focus: null,
      route: { ...context.route, panned: false },
      inputContext: "screen",
    });
    enqueue.raise({ type: "resume", input });
    enqueue({
      type: "output",
      params: {
        game: input.game,
        effects: [{ type: "close-scene" }],
        handled: true,
        ...(!input.game.dungeon ? { returnRequested: true } : {}),
      },
    });
    return;
  }
  const command = changed.command,
    committed = actInExpedition(input.game, command, input.route, input.adventure, input.rules);
  const beforeBattle = dungeonBattleInput(input).battle;
  const events: readonly ConfirmedBattleEvent[] =
    committed.result.accepted && committed.result.itemRecovery && command.type === "item"
      ? [{ ...committed.result.itemRecovery, actorId: command.actorId }, ...committed.result.events]
      : committed.result.events;
  // Accepted battle commands retain the confirmed result even after automatic defeat return.
  let confirmed: Parameters<typeof confirmBattleAction>[2];
  if (committed.result.accepted) {
    if (!beforeBattle || !committed.result.battleState)
      throw new Error("Accepted battle action requires a confirmed battle");
    confirmed = { accepted: true, record: { before: beforeBattle, after: committed.result.battleState, events } };
  } else confirmed = committed.result;
  enqueue.assign({
    battle: confirmBattleAction(changed.state, dungeonBattleInput({ ...input, game: committed.state }), confirmed),
  });
  enqueue({
    type: "output",
    params: {
      game: committed.state,
      effects: [],
      handled: committed.result.accepted,
      result: committed.result,
      completion: committed.completion,
    },
  });
});
const routeCommand = flow.enqueueActions(({ context, event, enqueue }) => {
  if (event.type === "branch") {
    const changed = reduceBranchRecovery(context.branch, event.input, event.event);
    if (!changed.handled) return;
    enqueue.assign({
      branch: changed.state,
      focus:
        changed.state.panel.kind === "closed" && changed.state.focus
          ? { kind: "branch", target: changed.state.focus }
          : null,
      inputContext: changed.state.panel.kind === "closed" ? "control" : "text-entry",
    });
    if (changed.command) enqueue.raise({ type: "commit", input: event.input, command: changed.command });
    else enqueue({ type: "output", params: { game: event.input.game, effects: [], handled: changed.handled } });
    return;
  }
  if (context.branch.panel.kind !== "closed") return;
  if (event.type === "enter")
    enqueue.raise({ type: "commit", input: event.input, command: { type: "enter", nodeId: event.nodeId } });
  else if (event.type === "key" && event.key === "Tab") {
    const order = routeFocusOrder(context, event.input),
      index = order.findIndex((target) => JSON.stringify(target) === JSON.stringify(context.focus));
    const position = index < 0 ? (event.shift ? order.length - 1 : 0) : index + (event.shift ? -1 : 1);
    enqueue.assign({ focus: order[position] ?? null, branch: { ...context.branch, focus: null } });
    enqueue({
      type: "output",
      params: { game: event.input.game, effects: [], handled: position >= 0 && position < order.length },
    });
  }
});
const conversationCommand = flow.enqueueActions(({ context, event, enqueue }) => {
  if (event.type === "advance" || event.type === "choose")
    enqueue.raise({ type: "commit", input: event.input, command: event });
  else if (event.type === "key") {
    const activity = event.input.game.dungeon?.activity;
    if (activity?.type !== "conversation") return;
    const mapped = adventureKeyCommand(activity.state, event.input.adventure, context.inputContext, event.code);
    if (mapped && mapped.type !== "select") enqueue.raise({ type: "commit", input: event.input, command: mapped });
  }
});
const returnRequested = flow.enqueueActions(({ event, enqueue }) => {
  if (event.type === "return")
    enqueue({ type: "output", params: { game: event.input.game, effects: [], handled: true, returnRequested: true } });
});
export const dungeonMachine = flow.createMachine({
  id: "dungeon",
  initial: "route",
  context: ({ input }) => initialContext(input.reducedMotion),
  on: {
    resume: [
      {
        guard: ({ event }) => hasPendingGrowth(event.input.game),
        target: ".growth",
        actions: assign({ growthFocus: { kind: "heading" } }),
      },
      {
        guard: ({ event }) => !event.input.game.dungeon,
        target: ".closed",
        actions: assign({ growthFocus: null }),
      },
      {
        guard: ({ event }) =>
          event.input.game.dungeon?.outcome === "cleared" || event.input.game.dungeon?.outcome === "failed",
        target: ".outcome",
        actions: assign(({ event }) => ({
          outcome: event.input.game.dungeon?.outcome === "cleared" ? "cleared" : "failed",
          growthFocus: null,
        })),
      },
      {
        guard: ({ event }) => event.input.game.dungeon?.activity?.type === "conversation",
        target: ".conversation",
        actions: assign({ growthFocus: null }),
      },
      { target: ".route", actions: assign({ growthFocus: null }) },
    ],
    closed: {
      target: ".closed",
      actions: enqueueActions(({ context, event, enqueue }) => {
        enqueue.assign({ battle: null, focus: null, growthFocus: null, inputContext: "screen" });
        enqueue({
          type: "output",
          params: { game: event.input.game, effects: context.battle ? [{ type: "close-scene" }] : [], handled: true },
        });
      }),
    },
    motion: { actions: assign(({ event }) => ({ reducedMotion: event.reduced })) },
    "input-context": {
      guard: ({ context, event }) => event.context !== context.inputContext,
      actions: assign(({ context, event }) => ({
        inputContext: event.context,
        ...(event.context === "screen" ? { focus: null, branch: { ...context.branch, focus: null } } : {}),
      })),
    },
    commit: {
      actions: enqueueActions(({ context, event, enqueue }) => {
        const { input, command } = event,
          committed = actInExpedition(input.game, command, input.route, input.adventure, input.rules);
        if (!committed.result.accepted) {
          enqueue.assign({ message: `操作できませんでした: ${committed.result.reason}` });
          enqueue({
            type: "output",
            params: { game: input.game, effects: [], handled: false, result: committed.result },
          });
          return;
        }
        const coreResult = committed.result;
        if (command.type === "enter" && coreResult.battleBefore && coreResult.battleState) {
          const owner = context.sceneOwner + 1,
            record: ConfirmedBattleRecord = {
              before: coreResult.battleBefore,
              after: coreResult.battleState,
              events: coreResult.events,
            };
          enqueue.assign({
            battle: createBattleModel(record, owner, context.speed, context.reducedMotion),
            sceneOwner: owner,
            branch: { ...context.branch, focus: null },
            focus: null,
            message: "",
            inputContext: "screen",
          });
          enqueue.raise({ type: "battle-started" });
          enqueue({
            type: "output",
            params: {
              game: committed.state,
              effects: [{ type: "open-scene", owner }],
              handled: true,
              result: coreResult,
              completion: committed.completion,
            },
          });
          return;
        }
        const branch =
          command.type === "branch-skill" || command.type === "branch-item"
            ? {
                panel: { kind: "closed" as const },
                focus:
                  command.type === "branch-item" && branchItemCount({ ...input, game: committed.state }) === 0
                    ? null
                    : { kind: command.type === "branch-item" ? ("item-trigger" as const) : ("skill-trigger" as const) },
              }
            : { ...context.branch, focus: null };
        const focus =
          command.type === "branch-item" && !branch.focus
            ? getAvailableDungeonNodes(coreResult.state, input.route)[0]?.id
            : undefined;
        enqueue.assign({
          branch,
          route: { ...context.route, panned: false },
          focus: branch.focus
            ? { kind: "branch", target: branch.focus }
            : command.type === "branch-item"
              ? focus
                ? { kind: "node", id: focus }
                : { kind: "return" }
              : null,
          message: "",
          inputContext: "screen",
          branchResult:
            command.type === "branch-skill" || command.type === "branch-item"
              ? branchSummary(coreResult)
              : context.branchResult,
        });
        enqueue.raise({ type: "resume", input: { ...input, game: committed.state } });
        enqueue({
          type: "output",
          params: {
            game: committed.state,
            effects: [],
            handled: true,
            result: coreResult,
            completion: committed.completion,
          },
        });
      }),
    },
    "battle-started": ".battle",
  },
  states: {
    route: {
      on: {
        enter: { actions: routeCommand },
        key: { actions: routeCommand },
        branch: { actions: routeCommand },
        return: { guard: ({ context }) => context.branch.panel.kind === "closed", actions: returnRequested },
        focused: {
          guard: ({ context, event }) =>
            context.branch.panel.kind === "closed" &&
            routeFocusOrder(context, event.input).some(
              (focus) => JSON.stringify(focus) === JSON.stringify(event.target),
            ),
          actions: assign(({ context, event }) => ({
            focus: event.target,
            branch: { ...context.branch, focus: null },
            inputContext: "control",
          })),
        },
        route: {
          guard: ({ context, event }) =>
            (event.event.type === "measured" || context.branch.panel.kind === "closed") &&
            (event.event.type !== "pan-key" || context.focus?.kind === "route"),
          actions: enqueueActions(({ context, event, enqueue }) => {
            const changed = reduceDungeonRoute(context.route, event.event, dungeonAccessibleIds(event.input));
            if (changed.state !== context.route) enqueue.assign({ route: changed.state });
            enqueue({
              type: "output",
              params: {
                game: event.input.game,
                effects: changed.capture === undefined ? [] : [{ type: "capture-pointer", pointerId: changed.capture }],
                handled: changed.handled,
              },
            });
          }),
        },
      },
    },
    conversation: {
      on: {
        key: { actions: conversationCommand },
        advance: { actions: conversationCommand },
        choose: { actions: conversationCommand },
        focused: {
          guard: ({ event }) =>
            event.target.kind === "choice" &&
            event.input.game.dungeon?.activity?.type === "conversation" &&
            getCurrentDungeonConversationScene(event.input.game.dungeon, event.input.adventure)?.type === "choice",
          actions: assign(({ context, event }) => ({
            focus: event.target,
            branch: { ...context.branch, focus: null },
            inputContext: "control",
          })),
        },
      },
    },
    growth: {
      on: {
        growth: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            if (!event.input.rules) return;
            if (event.event.type !== "choose") {
              const changed = reduceGrowthPresentation(
                context.growthFocus,
                event.event,
                event.input.game.growth?.choice ?? null,
              );
              enqueue.assign({ growthFocus: changed.focus });
              enqueue({ type: "output", params: { game: event.input.game, effects: [], handled: changed.handled } });
              return;
            }
            const changed = chooseGrowthSkill(event.input.game, event.event.skillId, event.input.rules);
            if (!changed.accepted) return;
            enqueue.assign({ route: { ...context.route, panned: false }, focus: null });
            enqueue.raise({ type: "resume", input: { ...event.input, game: changed.state } });
            enqueue({ type: "output", params: { game: changed.state, effects: [], handled: true } });
          }),
        },
      },
    },
    battle: { on: { battle: { actions: battleEvent }, motion: { actions: battleEvent } } },
    outcome: {
      on: {
        return: { actions: returnRequested },
        focused: {
          guard: ({ event }) => event.target.kind === "return",
          actions: assign(({ context, event }) => ({
            focus: event.target,
            branch: { ...context.branch, focus: null },
            inputContext: "control",
          })),
        },
      },
    },
    closed: { on: { "*": {} } },
  },
});
export type DungeonModel = SnapshotFrom<typeof dungeonMachine>;
export function createDungeonModel(input: DungeonInput, reducedMotion = false): DungeonModel {
  const [initial] = initialTransition(dungeonMachine, { reducedMotion });
  return transition(dungeonMachine, initial, { type: "resume", input })[0];
}
export function reduceDungeon(state: DungeonModel, input: DungeonInput, event: DungeonEvent): DungeonTransition {
  const [next, actions] = transition(dungeonMachine, state, { ...event, input });
  const output = actions.find((action) => action.type === "output");
  return { state: next, game: input.game, effects: [], handled: next !== state, ...output?.params };
}
