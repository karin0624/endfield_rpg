import { equipmentCatalog } from "../content/equipmentDefinitions";
import { itemCatalog } from "../content/itemSettings";
import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import type { BattleSkillRules } from "./battle";
import { assignedEquipmentStats } from "./equipment";
import { parseSavedEquipment } from "./equipmentSave";
import type { ExpeditionGame } from "./expedition";
import { growthStats, hasPendingGrowth } from "./growthRuntime";
import { parseSavedGrowth } from "./growthSave";
import { createInventory, type Inventory } from "./inventory";
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
    (game.inventory?.items.exploration ?? null) === null &&
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
function inventoryAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
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

function parseInventory(value: unknown): Inventory | undefined {
  if (!record(value) || !keys(value, ["items", "balance", "equipment"]) || !inventoryAmount(value.balance)) return;
  const equipment = parseSavedEquipment(value.equipment);
  if (!equipment) return;
  const items = value.items;
  if (
    !record(items) ||
    !keys(items, ["home", "importantIds", "exploration"]) ||
    items.exploration !== null ||
    !Array.isArray(items.home) ||
    !Array.isArray(items.importantIds)
  )
    return;
  const home: { itemId: string; quantity: number }[] = [];
  for (const stack of items.home) {
    if (
      !record(stack) ||
      !keys(stack, ["itemId", "quantity"]) ||
      typeof stack.itemId !== "string" ||
      !inventoryAmount(stack.quantity) ||
      stack.quantity < 1 ||
      !itemCatalog.some((item) => item.id === stack.itemId && item.kind === "consumable") ||
      home.some((s) => s.itemId === stack.itemId)
    )
      return;
    home.push({ itemId: stack.itemId, quantity: stack.quantity });
  }
  // No important items have production definitions yet; unknown saved IDs are not silently adopted.
  if (items.importantIds.length > 0) return;
  return {
    balance: value.balance,
    equipment,
    items: { home, importantIds: [], exploration: null },
  };
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
  if (value.version !== 5) return { accepted: false, reason: "unsupported-version" };
  if (!keys(value, ["version", "adventure", "party", "clock", "randomState", "growth", "inventory"])) return invalid;
  const { adventure, party, clock, randomState } = value;
  const inventory = parseInventory(value.inventory);
  if (!inventory) return invalid;
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
          assignedEquipmentStats(definition, inventory.equipment, equipmentCatalog).maxHp +
            (definitions.skills ? growthStats(member.id, growth, definitions.skills).maxHp : 0),
          status,
        )
    )
      return invalid;
    joined.add(member.id);
    members.push({ id: member.id, hp: member.hp, status, mentalFatigue });
  }
  if (inventory.equipment.assignments.some((a) => !joined.has(a.characterId))) return invalid;
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
    !keys(clock, ["elapsedHalfDays", "recoverySteps"]) ||
    !counter(clock.elapsedHalfDays) ||
    !counter(clock.recoverySteps) ||
    clock.recoverySteps * ACTION_HALF_DAYS > clock.elapsedHalfDays ||
    typeof randomState !== "number" ||
    !Number.isInteger(randomState) ||
    randomState < 0 ||
    randomState > 0xffffffff
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
      ...(inventory ? { inventory } : {}),
      clock: {
        elapsedHalfDays: clock.elapsedHalfDays,
        recoverySteps: clock.recoverySteps,
        pendingAction: null,
      },
      randomState,
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
  const inventory = game.inventory ?? createInventory();
  const data = JSON.stringify({
    version: 5,
    inventory: { balance: inventory.balance, equipment: inventory.equipment, items: inventory.items },
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
    },
    randomState: game.randomState ?? 1,
  });
  return deserializeGame(data, definitions).accepted
    ? { accepted: true, data }
    : { accepted: false, reason: "invalid-data" };
}
