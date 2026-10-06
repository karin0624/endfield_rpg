import * as v from "valibot";
import { equipmentCatalog } from "../content/equipmentDefinitions";
import { itemCatalog } from "../content/itemSettings";
import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import type { BattleSkillRules } from "./battle";
import { assignedEquipmentStats } from "./equipment";
import { restoreSavedEquipment, savedEquipment } from "./equipmentSave";
import type { ExpeditionGame } from "./expedition";
import { growthStats, hasPendingGrowth } from "./growthRuntime";
import { restoreSavedGrowth, savedGrowth } from "./growthSave";
import { createInventory, type Inventory } from "./inventory";
import type { CharacterDefinition, PartyMember } from "./party";
import { nonnegativeInteger, nonnegativeNumber, positiveInteger, savedRandomState } from "./saveFormat";
import { effectiveMaxHp, healthyStatus } from "./status";
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

const counter = v.pipe(nonnegativeInteger, v.maxValue(Number.MAX_SAFE_INTEGER - 1));
const savedStatus = v.strictObject({
  physicalFatigue: v.pipe(nonnegativeNumber, v.maxValue(loadSymptomDefinition.symptoms.physicalFatigue.cap)),
  haze: v.pipe(nonnegativeNumber, v.maxValue(loadSymptomDefinition.symptoms.haze.cap)),
  incapacityRecoverySteps: v.nullable(v.pipe(positiveInteger, v.maxValue(6))),
});
const savedInventory = v.strictObject({
  balance: nonnegativeInteger,
  equipment: savedEquipment,
  items: v.strictObject({
    home: v.array(v.strictObject({ itemId: v.string(), quantity: positiveInteger })),
    importantIds: v.array(v.string()),
    exploration: v.null(),
  }),
});
const slot = v.nullable(v.string());
const savedGame = v.strictObject({
  version: v.literal(5),
  adventure: v.strictObject({
    currentPlaceId: v.string(),
    flags: v.array(v.pipe(v.string(), v.minLength(1))),
  }),
  party: v.strictObject({
    members: v.array(
      v.strictObject({
        id: v.string(),
        hp: nonnegativeNumber,
        status: savedStatus,
        mentalFatigue: nonnegativeNumber,
      }),
    ),
    slots: v.strictTuple([slot, slot, slot, slot]),
  }),
  clock: v.strictObject({ elapsedHalfDays: counter, recoverySteps: counter }),
  randomState: savedRandomState,
  growth: v.nullable(savedGrowth),
  inventory: savedInventory,
});
const versionEnvelope = v.looseObject({ version: v.optional(v.unknown()) });

function restoreInventory(value: v.InferOutput<typeof savedInventory>): Inventory | undefined {
  const equipment = restoreSavedEquipment(value.equipment);
  if (!equipment) return;
  const { home, importantIds } = value.items;
  if (
    new Set(home.map((stack) => stack.itemId)).size !== home.length ||
    home.some((stack) => !itemCatalog.some((item) => item.id === stack.itemId && item.kind === "consumable")) ||
    // No important items have production definitions yet.
    importantIds.length > 0
  )
    return;
  return { balance: value.balance, equipment, items: { home, importantIds, exploration: null } };
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
  const envelope = v.safeParse(versionEnvelope, value);
  if (Array.isArray(value) || !envelope.success) return invalid;
  if (envelope.output.version !== 5) return { accepted: false, reason: "unsupported-version" };
  const parsed = v.safeParse(savedGame, value);
  if (!parsed.success) return invalid;
  const saved = parsed.output;
  const { adventure, party, clock, randomState } = saved;
  const inventory = restoreInventory(saved.inventory);
  if (!inventory) return invalid;
  if (
    !definitions.placeIds.includes(adventure.currentPlaceId) ||
    new Set(adventure.flags).size !== adventure.flags.length
  )
    return invalid;
  const growth =
    saved.growth !== null && definitions.skills
      ? restoreSavedGrowth(saved.growth, definitions.skills, randomState)
      : undefined;
  if (saved.growth !== null && !growth) return invalid;
  const members: PartyMember[] = [];
  const joined = new Set<string>();
  for (const member of party.members) {
    if (joined.has(member.id)) return invalid;
    const definition = definitions.characters.find(({ id }) => id === member.id);
    const status = member.status;
    const mentalFatigue = member.mentalFatigue;
    if (
      !definition ||
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
    if (!joined.has(id) || occupied.has(id)) return invalid;
    occupied.add(id);
  }
  if (clock.recoverySteps * ACTION_HALF_DAYS > clock.elapsedHalfDays) return invalid;
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
      party: { members, slots: party.slots },
      dungeon: null,
      ...(growth ? { growth } : {}),
      inventory,
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
