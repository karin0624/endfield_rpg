import { itemCatalog } from "../content/itemSettings";
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
  type DungeonBranchSkillInput,
  type DungeonDefinition,
  type DungeonSkillInput,
  type DungeonState,
  enterNextDungeonNode,
  performDungeonBasicAttack,
  performDungeonBranchSkill,
  performDungeonSkill,
} from "./dungeon";
import { equippedCharacters } from "./equipmentRuntime";
import { ensureGrowth, grownCharacters, hasPendingGrowth, projectGrowth, rewardGrowth } from "./growthRuntime";
import { finishInventory, type Inventory } from "./inventory";
import { type BagStack, type ItemStack, packItems } from "./items";
import { type DungeonItemInput, performDungeonRecoveryItem } from "./itemUse";
import type { LoadSymptomKind } from "./loadSymptoms";
import { type MentalFatigueDefinition, recoverMentalFatigue } from "./mentalFatigue";
import {
  type CharacterDefinition,
  characterById,
  confirmPartySelection,
  departureRejection,
  getPartyCombatants,
  type PartyRejection,
  type PartySlots,
  type PartyState,
  type RecruitmentRejection,
  recruitPartyMember,
  setPartySlot,
} from "./party";
import { type ExplorationSkills, resetExplorationSkills } from "./skillAcquisition";
import type { CharacterStatus } from "./status";
import {
  applyIncapacity,
  applyLoadSymptom,
  canParticipate,
  effectiveMaxHp,
  healthyStatus,
  recoverTownStep,
  symptomRecoverySteps,
} from "./status";
import {
  type ActionClock,
  type ActionCompletion,
  beginTimedAction,
  completeTimedAction,
  createActionClock,
} from "./time";

/** One shared session survives in-app navigation; persistent saves are separate. */
export interface ExpeditionGame {
  readonly inventory?: Inventory;
  readonly growth?: ExplorationSkills;
  readonly adventure: GameState;
  readonly party: PartyState;
  readonly dungeon: DungeonState | null;
  readonly randomState?: number;
  readonly clock?: ActionClock;
}
export type ExpeditionRejection =
  | "invalid-items"
  | PartyRejection
  | "not-in-town"
  | "not-on-route"
  | "action-in-progress";
export type ExpeditionResult =
  | { readonly accepted: true; readonly state: ExpeditionGame; readonly completion?: GameActionCompletion }
  | { readonly accepted: false; readonly state: ExpeditionGame; readonly reason: ExpeditionRejection };

export function editExpeditionParty(state: ExpeditionGame, slot: number, id: string | null): ExpeditionResult {
  if (hasPendingGrowth(state)) return { accepted: false, state, reason: "action-in-progress" };
  if (state.dungeon !== null || state.adventure.mode !== "town")
    return { accepted: false, state, reason: "not-in-town" };
  const result = setPartySlot(state.party, slot, id);
  return result.accepted
    ? { accepted: true, state: { ...state, party: result.state } }
    : { accepted: false, state, reason: result.reason };
}

/** Commit a complete quick-selection draft without exposing intermediate slot edits. */
export function confirmExpeditionParty(state: ExpeditionGame, draft: PartySlots): ExpeditionResult {
  if (hasPendingGrowth(state)) return { accepted: false, state, reason: "action-in-progress" };
  if (state.dungeon !== null || state.adventure.mode !== "town")
    return { accepted: false, state, reason: "not-in-town" };
  const result = confirmPartySelection(state.party, draft);
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
  itemSelection: readonly ItemStack[] = [],
): ExpeditionResult {
  if (hasPendingGrowth(state)) return { accepted: false, state, reason: "action-in-progress" };
  if (state.dungeon !== null || state.adventure.mode !== "town")
    return { accepted: false, state, reason: "not-in-town" };
  const clock = state.clock ?? createActionClock();
  if (clock.pendingAction !== null) return { accepted: false, state, reason: "action-in-progress" };
  const reason = departureRejection(state.party);
  if (reason) return { accepted: false, state, reason };
  const packed = state.inventory ? packItems(state.inventory.items, "dungeon", itemSelection, itemCatalog) : undefined;
  if (packed && !packed.accepted) return { accepted: false, state, reason: "invalid-items" };
  const ready = skills?.growth ? ensureGrowth(state, skills) : state;
  const dungeon = createDungeonState(
    route,
    adventure,
    getPartyCombatants(state.party, equippedCharacters(state, characters), skills?.catalog),
    state.adventure.flags,
    state.randomState ?? 1,
  );
  const departed = {
    ...ready,
    ...(state.inventory && packed?.accepted ? { inventory: { ...state.inventory, items: packed.state } } : {}),
    dungeon,
    clock: beginTimedAction(clock, "dungeon-expedition"),
  };
  return { accepted: true, state: skills?.growth ? projectGrowth(departed, departed.growth, skills) : departed };
}

export type DungeonCommand =
  | DungeonItemInput
  | { readonly type: "enter"; readonly nodeId: string }
  | { readonly type: "advance" }
  | { readonly type: "choose"; readonly optionId: string }
  | ({ readonly type: "branch-skill" } & DungeonBranchSkillInput)
  | ({ readonly type: "skill" } & DungeonSkillInput)
  | { readonly type: "attack"; readonly actorId: string; readonly targetId: string };

/** Commit the core result before rendering it. Roster HP follows the battle projection, preserving reserves. */
export function actInExpedition(
  state: ExpeditionGame,
  command: DungeonCommand,
  route: DungeonDefinition,
  adventure: AdventureDefinition,
  skills?: BattleSkillRules,
): {
  readonly state: ExpeditionGame;
  readonly result: DungeonActionResult;
  readonly completion?: GameActionCompletion;
} {
  if (state.dungeon === null)
    return { state, result: { accepted: false, state: null, reason: "dungeon-ended", events: [] } };
  if (hasPendingGrowth(state))
    return { state, result: { accepted: false, state: state.dungeon, reason: "pending-growth-choice", events: [] } };
  let result: DungeonActionResult;
  let inventory = state.inventory;
  switch (command.type) {
    case "item":
    case "branch-item": {
      if (!inventory)
        return {
          state,
          result: { accepted: false, state: state.dungeon, reason: "battle:skill-not-usable", events: [] },
        };
      const used = performDungeonRecoveryItem(inventory.items, state.dungeon, command, itemCatalog, route);
      result = used.result;
      inventory = { ...inventory, items: used.items };
      break;
    }
    case "branch-skill":
      result = skills
        ? performDungeonBranchSkill(state.dungeon, command, route, skills)
        : { accepted: false, state: state.dungeon, reason: "battle:skill-not-usable", events: [] };
      break;
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
  let updated: ExpeditionGame = {
    ...state,
    ...(inventory ? { inventory } : {}),
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
  };
  const resolved =
    !state.dungeon.resolvedNodeIds.includes(dungeon.currentNodeId) &&
    dungeon.resolvedNodeIds.includes(dungeon.currentNodeId);
  const node = route.nodes.find(({ id }) => id === dungeon.currentNodeId);
  if (
    skills?.growth &&
    resolved &&
    dungeon.outcome !== "failed" &&
    (node?.type === "battle" || node?.type === "conversation")
  ) {
    const experience = node.type === "battle" ? skills.growth.battleExperience : skills.growth.eventExperience;
    const reward = rewardGrowth(
      updated,
      {
        allocations: dungeon.party
          .filter((member) => canParticipate(member.hp, member.status))
          .map(({ id }) => ({
            characterId: id,
            experience,
          })),
      },
      skills,
    );
    if (!reward.accepted) throw new Error(`成長報酬を適用できません: ${reward.reason}`);
    updated = reward.state;
  }
  if (skills?.growth && dungeon.outcome === "failed") {
    const returned = leaveExpedition(updated, skills);
    if (!returned.accepted) throw new Error("敗北帰還を適用できません");
    return { state: returned.state, result, completion: returned.completion };
  }
  return { state: updated, result: { ...result, state: updated.dungeon ?? dungeon } };
}

/** Commit return healing and calendar cost together; symptoms and recovery counters persist. */
export function leaveExpedition(state: ExpeditionGame, skills?: BattleSkillRules): ExpeditionResult {
  if (hasPendingGrowth(state)) return { accepted: false, state, reason: "action-in-progress" };
  if (state.dungeon === null || state.dungeon.activity !== null)
    return { accepted: false, state, reason: "not-on-route" };
  const clock = state.clock ?? createActionClock();
  const pending = clock.pendingAction;
  if (pending?.kind !== "dungeon-expedition") return { accepted: false, state, reason: "not-on-route" };
  const result = completeTimedAction(clock);
  let resetState = state;
  if (skills?.growth && state.growth) {
    const reset = resetExplorationSkills(state.growth, skills.growth.progression, skills.catalog);
    if (!reset.accepted) return { accepted: false, state, reason: "not-on-route" };
    resetState = projectGrowth({ ...state, growth: reset.state }, state.growth, skills);
  }
  const returnedItems = resetState.inventory
    ? finishInventory(
        resetState.inventory,
        resetState.dungeon?.outcome === "cleared"
          ? "cleared"
          : resetState.dungeon?.outcome === "failed"
            ? "defeat"
            : "retreat",
        resetState.randomState ?? 1,
      )
    : undefined;
  if (returnedItems)
    resetState = { ...resetState, inventory: returnedItems.inventory, randomState: returnedItems.randomState };
  const returnedIds = resetState.dungeon?.party.map(({ id }) => id);
  const members = resetState.party.members.map((member) => {
    const participant = resetState.dungeon?.party.find(({ id }) => id === member.id);
    if (participant === undefined) return member;
    const status = member.status ?? healthyStatus();
    return { ...member, hp: effectiveMaxHp(participant.maxHp ?? participant.hp, status) };
  });
  return {
    accepted: true,
    state: { ...resetState, party: { ...resetState.party, members }, dungeon: null, clock: result.clock },
    completion:
      result.completion === undefined
        ? undefined
        : {
            ...result.completion,
            lostItems: returnedItems?.lost,
            recovery: [],
            returnedIds,
            outcome: resetState.dungeon?.outcome,
          },
  };
}

/** Recovery is part of the current town exploration's synchronous completion. */
function recoverTownParty(
  state: ExpeditionGame,
  characters: readonly CharacterDefinition[],
  fatigue?: MentalFatigueDefinition,
): ExpeditionGame {
  return {
    ...state,
    party: {
      ...state.party,
      members: state.party.members.map((member) => {
        const status = recoverTownStep(member.status ?? healthyStatus());
        return {
          ...member,
          mentalFatigue: fatigue ? recoverMentalFatigue(member.mentalFatigue ?? 0, fatigue) : member.mentalFatigue,
          status,
          hp: Math.min(
            member.hp,
            effectiveMaxHp(characterById(equippedCharacters(state, characters), member.id).maxHp, status),
          ),
        };
      }),
    },
  };
}
/** Onset hook for town events; numeric mental fatigue and event selection live outside this core. */
export function applyPartyStatus(
  state: ExpeditionGame,
  id: string,
  effect: { readonly kind: LoadSymptomKind; readonly amount: number } | { readonly kind: "incapacity" },
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
        const status =
          effect.kind === "incapacity"
            ? applyIncapacity(previous)
            : applyLoadSymptom(previous, effect.kind, effect.amount);
        return {
          ...member,
          status,
          hp: Math.min(
            member.hp,
            effectiveMaxHp(characterById(equippedCharacters(state, characters), id).maxHp, status),
          ),
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
  readonly lostItems?: readonly BagStack[];
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
      readonly reason:
        | AdventureRejectionReason
        | RecruitmentRejection
        | "invalid-items"
        | "action-in-progress"
        | "action-not-current";
    };

/** Nonbattle exploration has no party participation requirement. */
export function beginTownExploration(
  state: ExpeditionGame,
  placeId: string,
  definition: AdventureDefinition,
  itemSelection: readonly ItemStack[] = [],
): TownActionResult {
  if (hasPendingGrowth(state)) return { accepted: false, state, reason: "action-in-progress" };
  if (state.dungeon !== null) return { accepted: false, state, reason: "not-in-town" };
  const clock = state.clock ?? createActionClock();
  if (clock.pendingAction !== null) return { accepted: false, state, reason: "action-in-progress" };
  const packed = state.inventory ? packItems(state.inventory.items, "town", itemSelection, itemCatalog) : undefined;
  if (packed && !packed.accepted) return { accepted: false, state, reason: "invalid-items" };
  const result = selectTownPlace(state.adventure, placeId, definition);
  if (!result.accepted) return { accepted: false, state, reason: result.reason };
  return {
    accepted: true,
    state: {
      ...state,
      ...(state.inventory && packed?.accepted ? { inventory: { ...state.inventory, items: packed.state } } : {}),
      adventure: result.state,
      clock: beginTimedAction(clock, "town-exploration"),
    },
  };
}

/** Complete the current town activity after its conversation has returned to town. */
function completeTownExploration(
  state: ExpeditionGame,
  characters: readonly CharacterDefinition[],
  fatigue?: MentalFatigueDefinition,
): TownActionResult {
  const clock = state.clock ?? createActionClock();
  const result = completeTimedAction(clock);
  if (result.completion === undefined) return { accepted: false, state, reason: "action-not-current" };
  let returnedState = state;
  if (state.inventory) {
    const returnedItems = finishInventory(state.inventory, "cleared", state.randomState ?? 1);
    returnedState = { ...state, inventory: returnedItems.inventory, randomState: returnedItems.randomState };
  }
  // Calendar, returned items and all members' recovery are committed together.
  const recovered = recoverTownParty({ ...returnedState, clock: result.clock }, characters, fatigue);
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
        physicalFatigue: symptomRecoverySteps(after.physicalFatigue, "physicalFatigue"),
        haze: symptomRecoverySteps(after.haze, "haze"),
        incapacity: after.incapacityRecoverySteps ?? 0,
      },
    };
  });
  return { accepted: true, state: recovered, completion: { ...result.completion, recovery } };
}
export type TownCommand = { readonly type: "advance" } | { readonly type: "choose"; readonly optionId: string };
/** Apply a conversation command to the current town exploration. */
export function actInTown(
  state: ExpeditionGame,
  command: TownCommand,
  characters: readonly CharacterDefinition[],
  definition: AdventureDefinition,
  fatigue?: MentalFatigueDefinition,
  skills?: BattleSkillRules,
): TownActionResult {
  const pending = state.clock?.pendingAction;
  if (pending?.kind !== "town-exploration") return { accepted: false, state, reason: "action-not-current" };
  if (hasPendingGrowth(state)) return { accepted: false, state, reason: "action-in-progress" };
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
  const completed = completeTownExploration(
    updated,
    skills?.growth ? grownCharacters({ ...updated, inventory: undefined }, skills) : characters,
    fatigue,
  );
  if (completed.accepted && skills?.growth) {
    const ready = ensureGrowth(completed.state, skills);
    const experience = skills.growth.townExperience;
    if (!ready.growth?.townExperienceClaimed) {
      const reward = rewardGrowth(
        ready,
        {
          allocations: ready.party.members
            .filter((member) => canParticipate(member.hp, member.status))
            .map(({ id }) => ({ characterId: id, experience })),
        },
        skills,
      );
      if (!reward.accepted) throw new Error(`街の成長報酬を適用できません: ${reward.reason}`);
      return {
        ...completed,
        state: { ...reward.state, growth: { ...reward.state.growth, townExperienceClaimed: true } },
        completion: completed.completion ? { ...completed.completion, recruitedIds } : undefined,
      };
    }
  }
  return completed.accepted && completed.completion !== undefined
    ? { ...completed, completion: { ...completed.completion, recruitedIds } }
    : completed;
}
