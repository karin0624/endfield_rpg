import {
  type AdventureDefinition,
  type AdventureRejectionReason,
  advanceConversation,
  chooseConversationOption,
  selectTownPlace,
} from "./adventure";
import type { BattleSkillRules } from "./battle";
import type { GameState } from "./createInitialGameState";
import {
  advanceDungeonConversation,
  chooseDungeonConversationOption,
  createDungeonState,
  type DungeonActionResult,
  type DungeonDefinition,
  type DungeonSkillInput,
  type DungeonState,
  enterNextDungeonNode,
  performDungeonBasicAttack,
  performDungeonSkill,
} from "./dungeon";
import { type MentalFatigueDefinition, recoverMentalFatigue } from "./mentalFatigue";
import {
  type CharacterDefinition,
  characterById,
  departureRejection,
  getPartyCombatants,
  type PartyRejection,
  type PartyState,
  type RecruitmentRejection,
  recruitPartyMember,
  setPartySlot,
} from "./party";
import type { CharacterStatus } from "./status";
import {
  applyIncapacity,
  applyStagedStatus,
  effectiveMaxHp,
  healthyStatus,
  recoverTownStep,
  type StagedStatusKind,
} from "./status";
import {
  type ActionClock,
  type ActionCompletion,
  beginTimedAction,
  completeTimedAction,
  createActionClock,
  type TimedAction,
} from "./time";

/** One shared session survives in-app navigation; persistent saves are separate. */
export interface ExpeditionGame {
  readonly adventure: GameState;
  readonly party: PartyState;
  readonly dungeon: DungeonState | null;
  readonly randomState?: number;
  readonly lastTownRecoverySignal?: number;
  readonly clock?: ActionClock;
}
export type ExpeditionRejection = PartyRejection | "not-in-town" | "not-on-route" | "action-in-progress";
export type ExpeditionResult =
  | { readonly accepted: true; readonly state: ExpeditionGame; readonly completion?: GameActionCompletion }
  | { readonly accepted: false; readonly state: ExpeditionGame; readonly reason: ExpeditionRejection };

export function editExpeditionParty(state: ExpeditionGame, slot: number, id: string | null): ExpeditionResult {
  if (state.dungeon !== null || state.adventure.mode !== "town")
    return { accepted: false, state, reason: "not-in-town" };
  const result = setPartySlot(state.party, slot, id);
  return result.accepted
    ? { accepted: true, state: { ...state, party: result.state } }
    : { accepted: false, state, reason: result.reason };
}

export function departOnExpedition(
  state: ExpeditionGame,
  characters: readonly CharacterDefinition[],
  route: DungeonDefinition,
  adventure: AdventureDefinition,
  skills?: BattleSkillRules,
): ExpeditionResult {
  if (state.dungeon !== null || state.adventure.mode !== "town")
    return { accepted: false, state, reason: "not-in-town" };
  const clock = state.clock ?? createActionClock();
  if (clock.pendingAction !== null) return { accepted: false, state, reason: "action-in-progress" };
  const reason = departureRejection(state.party);
  if (reason) return { accepted: false, state, reason };
  const dungeon = createDungeonState(
    route,
    adventure,
    getPartyCombatants(state.party, characters, skills?.catalog),
    state.adventure.flags,
    state.randomState ?? 1,
  );
  return {
    accepted: true,
    state: {
      ...state,
      dungeon: { ...dungeon, expeditionActionId: clock.nextActionId },
      clock: beginTimedAction(clock, "dungeon-expedition"),
    },
  };
}

export type DungeonCommand =
  | { readonly type: "enter"; readonly nodeId: string }
  | { readonly type: "advance" }
  | { readonly type: "choose"; readonly optionId: string }
  | ({ readonly type: "skill" } & DungeonSkillInput)
  | { readonly type: "attack"; readonly actorId: string; readonly targetId: string };

/** Commit the core result before rendering it. Roster HP follows the battle projection, preserving reserves. */
export function actInExpedition(
  state: ExpeditionGame,
  command: DungeonCommand,
  route: DungeonDefinition,
  adventure: AdventureDefinition,
  skills?: BattleSkillRules,
): { readonly state: ExpeditionGame; readonly result: DungeonActionResult } {
  if (state.dungeon === null) throw new Error("探索を開始していません");
  let result: DungeonActionResult;
  switch (command.type) {
    case "skill":
      result = skills
        ? performDungeonSkill(state.dungeon, command, route, skills)
        : { accepted: false, state: state.dungeon, reason: "battle:skill-not-usable", events: [] };
      break;
    case "enter":
      result = enterNextDungeonNode(state.dungeon, command.nodeId, route, adventure);
      break;
    case "advance":
      result = advanceDungeonConversation(state.dungeon, adventure);
      break;
    case "choose":
      result = chooseDungeonConversationOption(state.dungeon, command.optionId, adventure);
      break;
    case "attack":
      result = performDungeonBasicAttack(state.dungeon, command.actorId, command.targetId, route);
      break;
  }
  if (!result.accepted) return { state, result };
  const dungeon = result.state;
  return {
    state: {
      ...state,
      dungeon,
      randomState: dungeon.randomState,
      party: {
        ...state.party,
        members: state.party.members.map((member) => {
          const participant = dungeon.party.find(({ id }) => id === member.id);
          return participant === undefined
            ? member
            : {
                ...member,
                hp: participant.hp,
                status: participant.status,
                mentalFatigue: participant.mentalFatigue ?? 0,
              };
        }),
      },
      adventure: { ...state.adventure, flags: dungeon.flags },
    },
    result,
  };
}

/** Commit return healing and calendar cost together; symptoms and recovery counters persist. */
export function leaveExpedition(state: ExpeditionGame, actionId = state.clock?.pendingAction?.id): ExpeditionResult {
  if (state.dungeon === null || state.dungeon.activity !== null)
    return { accepted: false, state, reason: "not-on-route" };
  const clock = state.clock ?? createActionClock();
  const pending = clock.pendingAction;
  if (pending?.kind !== "dungeon-expedition" || pending.id !== actionId)
    return { accepted: false, state, reason: "not-on-route" };
  const result = completeTimedAction(clock, pending);
  const returnedIds = state.dungeon.party.map(({ id }) => id);
  const members = state.party.members.map((member) => {
    const participant = state.dungeon?.party.find(({ id }) => id === member.id);
    if (participant === undefined) return member;
    const status = member.status ?? healthyStatus();
    return { ...member, hp: effectiveMaxHp(participant.maxHp ?? participant.hp, status) };
  });
  return {
    accepted: true,
    state: { ...state, party: { ...state.party, members }, dungeon: null, clock: result.clock },
    completion:
      result.completion === undefined
        ? undefined
        : {
            ...result.completion,
            recovery: [],
            returnedIds,
            outcome: state.dungeon.outcome,
          },
  };
}

/** Town integration supplies a monotonically increasing signal; duplicate delivery is a no-op. */
export function receiveTownRecoverySignal(
  state: ExpeditionGame,
  signal: number,
  characters: readonly CharacterDefinition[],
  fatigue?: MentalFatigueDefinition,
): ExpeditionGame {
  if (!Number.isSafeInteger(signal) || signal < 0) throw new RangeError("回復signalは非負の整数です");
  if (signal <= (state.lastTownRecoverySignal ?? -1)) return state;
  // Consume ineligible deliveries too, so delayed replay cannot recover dungeon time.
  if (state.dungeon !== null || state.adventure.mode !== "town") return { ...state, lastTownRecoverySignal: signal };
  return {
    ...state,
    lastTownRecoverySignal: signal,
    party: {
      ...state.party,
      members: state.party.members.map((member) => {
        const status = recoverTownStep(member.status ?? healthyStatus());
        return {
          ...member,
          mentalFatigue: fatigue ? recoverMentalFatigue(member.mentalFatigue ?? 0, fatigue) : member.mentalFatigue,
          status,
          hp: Math.min(member.hp, effectiveMaxHp(characterById(characters, member.id).maxHp, status)),
        };
      }),
    },
  };
}
/** Onset hook for town events; numeric mental fatigue and event selection live outside this core. */
export function applyPartyStatus(
  state: ExpeditionGame,
  id: string,
  kind: StagedStatusKind | "incapacity",
  characters: readonly CharacterDefinition[],
): ExpeditionGame {
  if (state.dungeon !== null || !state.party.members.some((member) => member.id === id)) return state;
  return {
    ...state,
    party: {
      ...state.party,
      members: state.party.members.map((member) => {
        if (member.id !== id) return member;
        const previous = member.status ?? healthyStatus();
        const status = kind === "incapacity" ? applyIncapacity(previous) : applyStagedStatus(previous, kind);
        return {
          ...member,
          status,
          hp: Math.min(member.hp, effectiveMaxHp(characterById(characters, id).maxHp, status)),
        };
      }),
    },
  };
}

export interface CharacterRecoveryChange {
  readonly mentalFatigueBefore?: number;
  readonly mentalFatigueAfter?: number;
  readonly id: string;
  readonly before: CharacterStatus;
  readonly after: CharacterStatus;
  readonly remainingSteps: { readonly physicalFatigue: number; readonly haze: number; readonly incapacity: number };
}
export interface GameActionCompletion extends ActionCompletion {
  readonly returnedIds?: readonly string[];
  readonly outcome?: DungeonState["outcome"];
  readonly recruitedIds?: readonly string[];
  readonly recovery: readonly CharacterRecoveryChange[];
}
export type TownActionResult =
  | { readonly accepted: true; readonly state: ExpeditionGame; readonly completion?: GameActionCompletion }
  | {
      readonly accepted: false;
      readonly state: ExpeditionGame;
      readonly reason: AdventureRejectionReason | RecruitmentRejection | "action-in-progress" | "action-not-current";
    };

/** Nonbattle exploration has no party participation requirement. */
export function beginTownExploration(
  state: ExpeditionGame,
  placeId: string,
  definition: AdventureDefinition,
): TownActionResult {
  if (state.dungeon !== null) return { accepted: false, state, reason: "not-in-town" };
  const clock = state.clock ?? createActionClock();
  if (clock.pendingAction !== null) return { accepted: false, state, reason: "action-in-progress" };
  const result = selectTownPlace(state.adventure, placeId, definition);
  if (!result.accepted) return { accepted: false, state, reason: result.reason };
  return {
    accepted: true,
    state: { ...state, adventure: result.state, clock: beginTimedAction(clock, "town-exploration") },
  };
}

/** Complete only the current action after its conversation has returned to town. */
export function completeTownExploration(
  state: ExpeditionGame,
  action: TimedAction,
  characters: readonly CharacterDefinition[],
  fatigue?: MentalFatigueDefinition,
): TownActionResult {
  const clock = state.clock ?? createActionClock();
  if (state.dungeon !== null || state.adventure.mode !== "town")
    return { accepted: false, state, reason: "not-in-town" };
  if (action.kind !== "town-exploration") return { accepted: false, state, reason: "action-not-current" };
  const result = completeTimedAction(clock, action);
  if (result.completion === undefined) return { accepted: false, state, reason: "action-not-current" };
  // Recovery notifications have their own watermark, independent of action/calendar IDs.
  const recovered = receiveTownRecoverySignal(
    { ...state, clock: result.clock },
    (state.lastTownRecoverySignal ?? -1) + 1,
    characters,
    fatigue,
  );
  const recovery = recovered.party.members.map((member) => {
    const before = state.party.members.find(({ id }) => id === member.id)?.status ?? healthyStatus();
    const after = member.status ?? healthyStatus();
    return {
      id: member.id,
      mentalFatigueBefore: state.party.members.find(({ id }) => id === member.id)?.mentalFatigue ?? 0,
      mentalFatigueAfter: member.mentalFatigue ?? 0,
      before,
      after,
      remainingSteps: {
        physicalFatigue: after.physicalFatigue,
        haze: after.haze,
        incapacity: after.incapacityRecoverySteps ?? 0,
      },
    };
  });
  return { accepted: true, state: recovered, completion: { ...result.completion, recovery } };
}
export type TownCommand = { readonly type: "advance" } | { readonly type: "choose"; readonly optionId: string };
/** The caller passes the action ID with every command, including retries from an old screen. */
export function actInTown(
  state: ExpeditionGame,
  actionId: number,
  command: TownCommand,
  characters: readonly CharacterDefinition[],
  definition: AdventureDefinition,
  fatigue?: MentalFatigueDefinition,
): TownActionResult {
  const pending = state.clock?.pendingAction;
  if (pending?.kind !== "town-exploration" || pending.id !== actionId)
    return { accepted: false, state, reason: "action-not-current" };
  if (state.dungeon !== null) return { accepted: false, state, reason: "not-in-town" };
  const result =
    command.type === "advance"
      ? advanceConversation(state.adventure, definition)
      : chooseConversationOption(state.adventure, command.optionId, definition);
  if (!result.accepted) return { accepted: false, state, reason: result.reason };
  let updated = { ...state, adventure: result.state };
  const recruitedIds: string[] = [];
  for (const effect of result.recruitments ?? []) {
    const recruited = recruitPartyMember(updated.party, effect, characters, updated.adventure.flags);
    if (!recruited.accepted) return { accepted: false, state, reason: recruited.reason };
    if (recruited.added) recruitedIds.push(effect.characterId);
    updated = {
      ...updated,
      party: recruited.state,
      adventure: {
        ...updated.adventure,
        flags: recruited.added
          ? [...new Set([...updated.adventure.flags, ...(effect.setFlags ?? [])])]
          : updated.adventure.flags,
      },
    };
  }
  if (result.state.mode !== "town") return { accepted: true, state: updated };
  const completed = completeTownExploration(updated, pending, characters, fatigue);
  return completed.accepted && completed.completion !== undefined
    ? { ...completed, completion: { ...completed.completion, recruitedIds } }
    : completed;
}
