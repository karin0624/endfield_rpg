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
  departureRejection,
  getPartyCombatants,
  type PartyRejection,
  type PartyState,
  setPartySlot,
} from "./party";

/** The browser keeps one session in memory. Save/restore and return recovery belong to later milestones. */
export interface ExpeditionGame {
  readonly adventure: GameState;
  readonly party: PartyState;
  readonly dungeon: DungeonState | null;
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
      party: {
        ...state.party,
        members: state.party.members.map((member) => {
          const participant = dungeon.party.find(({ id }) => id === member.id);
          return participant === undefined ? member : { ...member, hp: participant.hp };
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
