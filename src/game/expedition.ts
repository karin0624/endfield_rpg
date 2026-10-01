import type { AdventureDefinition } from "./adventure";
import type { GameState } from "./createInitialGameState";
import {
  advanceDungeonConversation,
  chooseDungeonConversationOption,
  createDungeonState,
  type DungeonActionResult,
  type DungeonDefinition,
  type DungeonState,
  enterNextDungeonNode,
  performDungeonBasicAttack,
} from "./dungeon";
import {
  type CharacterDefinition,
  characterById,
  departureRejection,
  getPartyCombatants,
  type PartyRejection,
  type PartyState,
  setPartySlot,
} from "./party";
import {
  applyIncapacity,
  applyStagedStatus,
  effectiveMaxHp,
  healthyStatus,
  recoverTownStep,
  type StagedStatusKind,
} from "./status";

/** The browser keeps one session in memory. Save/restore and return recovery belong to later milestones. */
export interface ExpeditionGame {
  readonly adventure: GameState;
  readonly party: PartyState;
  readonly dungeon: DungeonState | null;
  readonly randomState?: number;
  readonly lastTownRecoverySignal?: number;
}
export type ExpeditionRejection = PartyRejection | "not-in-town" | "not-on-route";
export type ExpeditionResult =
  | { readonly accepted: true; readonly state: ExpeditionGame }
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
): ExpeditionResult {
  if (state.dungeon !== null || state.adventure.mode !== "town")
    return { accepted: false, state, reason: "not-in-town" };
  const reason = departureRejection(state.party);
  if (reason) return { accepted: false, state, reason };
  const dungeon = createDungeonState(
    route,
    adventure,
    getPartyCombatants(state.party, characters),
    state.adventure.flags,
    state.randomState ?? 1,
  );
  return { accepted: true, state: { ...state, dungeon } };
}

export type DungeonCommand =
  | { readonly type: "enter"; readonly nodeId: string }
  | { readonly type: "advance" }
  | { readonly type: "choose"; readonly optionId: string }
  | { readonly type: "attack"; readonly actorId: string; readonly targetId: string };

/** Commit the core result before rendering it. Roster HP follows the battle projection, preserving reserves. */
export function actInExpedition(
  state: ExpeditionGame,
  command: DungeonCommand,
  route: DungeonDefinition,
  adventure: AdventureDefinition,
): { readonly state: ExpeditionGame; readonly result: DungeonActionResult } {
  if (state.dungeon === null) throw new Error("探索を開始していません");
  let result: DungeonActionResult;
  switch (command.type) {
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
          return participant === undefined ? member : { ...member, hp: participant.hp, status: participant.status };
        }),
      },
      adventure: { ...state.adventure, flags: dungeon.flags },
    },
    result,
  };
}

/** Route/outcome exit retains HP. Full recovery and the half-day cost are integrated in #16. */
export function leaveExpedition(state: ExpeditionGame): ExpeditionResult {
  if (state.dungeon === null || state.dungeon.activity !== null)
    return { accepted: false, state, reason: "not-on-route" };
  return { accepted: true, state: { ...state, dungeon: null } };
}

/** Town integration supplies a monotonically increasing signal; duplicate delivery is a no-op. */
export function receiveTownRecoverySignal(
  state: ExpeditionGame,
  signal: number,
  characters: readonly CharacterDefinition[],
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
