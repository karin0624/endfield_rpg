import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import type { BattleSkillRules } from "./battle";
import type { ExpeditionGame } from "./expedition";
import { growthStats, hasPendingGrowth } from "./growthRuntime";
import { parseSavedGrowth } from "./growthSave";
import type { CharacterDefinition, PartyMember, PartySlots } from "./party";
import { type CharacterStatus, effectiveMaxHp, healthyStatus } from "./status";
import { ACTION_HALF_DAYS, createActionClock } from "./time";

export interface SaveDefinitions {
  readonly skills?: BattleSkillRules;
  readonly characters: readonly CharacterDefinition[];
  readonly placeIds: readonly string[];
  readonly recruitmentFlags?: readonly { readonly flag: string; readonly characterId: string }[];
}
export type SaveReadResult =
  | { readonly accepted: true; readonly state: ExpeditionGame }
  | { readonly accepted: false; readonly reason: "invalid-data" | "unsupported-version" };

export function canSaveGame(game: ExpeditionGame): boolean {
  return (
    !hasPendingGrowth(game) &&
    game.adventure.mode === "town" &&
    game.adventure.conversationId === null &&
    game.adventure.conversationPosition === null &&
    game.dungeon === null &&
    (game.clock?.pendingAction ?? null) === null
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
function counter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER;
}
function symptomValue(value: unknown, cap: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= cap;
}
function parseStatus(value: unknown): CharacterStatus | undefined {
  if (!record(value) || !keys(value, ["physicalFatigue", "haze", "incapacityRecoverySteps"])) return;
  const { physicalFatigue, haze, incapacityRecoverySteps } = value;
  if (
    !symptomValue(physicalFatigue, loadSymptomDefinition.symptoms.physicalFatigue.cap) ||
    !symptomValue(haze, loadSymptomDefinition.symptoms.haze.cap) ||
    !(
      incapacityRecoverySteps === null ||
      (counter(incapacityRecoverySteps) && incapacityRecoverySteps >= 1 && incapacityRecoverySteps <= 6)
    )
  )
    return;
  return { physicalFatigue, haze, incapacityRecoverySteps };
}

/** Reconstruct only persisted logical fields; never execute game actions during restoration. */
export function deserializeGame(data: string, definitions: SaveDefinitions): SaveReadResult {
  const invalid = { accepted: false, reason: "invalid-data" } as const;
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return invalid;
  }
  if (!record(value)) return invalid;
  if (value.version !== 4) return { accepted: false, reason: "unsupported-version" };
  if (!keys(value, ["version", "adventure", "party", "clock", "randomState", "lastTownRecoverySignal", "growth"]))
    return invalid;
  const { adventure, party, clock, randomState, lastTownRecoverySignal } = value;
  if (
    !record(adventure) ||
    !keys(adventure, ["currentPlaceId", "flags"]) ||
    typeof adventure.currentPlaceId !== "string" ||
    !definitions.placeIds.includes(adventure.currentPlaceId) ||
    !Array.isArray(adventure.flags) ||
    !adventure.flags.every((flag) => typeof flag === "string" && flag.length > 0) ||
    new Set(adventure.flags).size !== adventure.flags.length
  )
    return invalid;
  if (
    !record(party) ||
    !keys(party, ["members", "slots"]) ||
    !Array.isArray(party.members) ||
    !Array.isArray(party.slots) ||
    party.slots.length !== 4
  )
    return invalid;
  const growth =
    value.growth !== null && definitions.skills && typeof randomState === "number"
      ? parseSavedGrowth(value.growth, definitions.skills, randomState)
      : undefined;
  if (value.growth !== null && !growth) return invalid;
  const members: PartyMember[] = [];
  const joined = new Set<string>();
  for (const member of party.members) {
    if (
      !record(member) ||
      !keys(member, ["id", "hp", "status", "mentalFatigue"]) ||
      typeof member.id !== "string" ||
      joined.has(member.id)
    )
      return invalid;
    const definition = definitions.characters.find(({ id }) => id === member.id);
    const status = parseStatus(member.status);
    const mentalFatigue = member.mentalFatigue;
    if (
      !definition ||
      !status ||
      typeof mentalFatigue !== "number" ||
      !Number.isFinite(mentalFatigue) ||
      mentalFatigue < 0 ||
      typeof member.hp !== "number" ||
      !Number.isFinite(member.hp) ||
      member.hp < 0 ||
      member.hp >
        effectiveMaxHp(
          definition.maxHp + (definitions.skills ? growthStats(member.id, growth, definitions.skills).maxHp : 0),
          status,
        )
    )
      return invalid;
    joined.add(member.id);
    members.push({ id: member.id, hp: member.hp, status, mentalFatigue });
  }
  const occupied = new Set<string>();
  const flags = adventure.flags;
  if (definitions.recruitmentFlags?.some(({ flag, characterId }) => flags.includes(flag) && !joined.has(characterId)))
    return invalid;
  for (const id of party.slots) {
    if (id === null) continue;
    if (typeof id !== "string" || !joined.has(id) || occupied.has(id)) return invalid;
    occupied.add(id);
  }
  if (
    !record(clock) ||
    !keys(clock, ["elapsedHalfDays", "recoverySteps", "nextActionId"]) ||
    !counter(clock.elapsedHalfDays) ||
    !counter(clock.recoverySteps) ||
    !counter(clock.nextActionId) ||
    clock.nextActionId < 1 ||
    clock.elapsedHalfDays !== (clock.nextActionId - 1) * ACTION_HALF_DAYS ||
    clock.recoverySteps > clock.nextActionId - 1 ||
    typeof randomState !== "number" ||
    !Number.isInteger(randomState) ||
    randomState < 0 ||
    randomState > 0xffffffff ||
    !(lastTownRecoverySignal === null || counter(lastTownRecoverySignal)) ||
    (clock.recoverySteps > 0 && (lastTownRecoverySignal === null || lastTownRecoverySignal < clock.recoverySteps - 1))
  )
    return invalid;
  return {
    accepted: true,
    state: {
      adventure: {
        mode: "town",
        currentPlaceId: adventure.currentPlaceId,
        conversationId: null,
        conversationPosition: null,
        flags: [...adventure.flags],
      },
      party: { members, slots: [...party.slots] as unknown as PartySlots },
      dungeon: null,
      ...(growth ? { growth } : {}),
      clock: {
        elapsedHalfDays: clock.elapsedHalfDays,
        recoverySteps: clock.recoverySteps,
        nextActionId: clock.nextActionId,
        pendingAction: null,
      },
      randomState,
      ...(lastTownRecoverySignal === null ? {} : { lastTownRecoverySignal }),
    },
  };
}

export function serializeGame(
  game: ExpeditionGame,
  definitions: SaveDefinitions,
):
  | { readonly accepted: true; readonly data: string }
  | { readonly accepted: false; readonly reason: "not-in-town" | "invalid-data" } {
  if (!canSaveGame(game)) return { accepted: false, reason: "not-in-town" };
  const clock = game.clock ?? createActionClock();
  const data = JSON.stringify({
    version: 4,
    growth: game.growth ? { ...game.growth, randomState: game.randomState ?? 1 } : null,
    adventure: { currentPlaceId: game.adventure.currentPlaceId, flags: game.adventure.flags },
    party: {
      members: game.party.members.map(({ id, hp, status, mentalFatigue }) => ({
        id,
        hp,
        status: status ?? healthyStatus(),
        mentalFatigue: mentalFatigue ?? 0,
      })),
      slots: game.party.slots,
    },
    clock: {
      elapsedHalfDays: clock.elapsedHalfDays,
      recoverySteps: clock.recoverySteps,
      nextActionId: clock.nextActionId,
    },
    randomState: game.randomState ?? 1,
    lastTownRecoverySignal: game.lastTownRecoverySignal ?? null,
  });
  return deserializeGame(data, definitions).accepted
    ? { accepted: true, data }
    : { accepted: false, reason: "invalid-data" };
}
