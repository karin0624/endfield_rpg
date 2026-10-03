import { equipmentCatalog } from "../content/equipmentDefinitions";
import type { BattleSkillRules } from "./battle";
import { assignEquipment, assignedEquipmentStats, type EquipmentSlot } from "./equipment";
import type { ExpeditionGame } from "./expedition";
import { growthStats, hasPendingGrowth } from "./growthRuntime";
import type { CharacterDefinition } from "./party";
import { effectiveMaxHp, healthyStatus } from "./status";

export function equippedCharacters(game: ExpeditionGame, definitions: readonly CharacterDefinition[]) {
  return definitions.map((base) =>
    game.inventory ? assignedEquipmentStats(base, game.inventory.equipment, equipmentCatalog) : base,
  );
}
export function editHomeEquipment(
  game: ExpeditionGame,
  location: "home" | "exploration",
  characterId: string,
  slot: EquipmentSlot,
  instanceId: string | null,
  definitions: readonly CharacterDefinition[],
  rules: BattleSkillRules,
) {
  const rejected = { accepted: false as const, state: game };
  const inventory = game.inventory;
  const base = definitions.find((c) => c.id === characterId);
  if (
    !inventory ||
    !base ||
    location !== "home" ||
    game.dungeon ||
    game.clock?.pendingAction ||
    inventory.items.exploration ||
    hasPendingGrowth(game) ||
    !game.party.members.some((m) => m.id === characterId)
  )
    return rejected;
  const assigned = assignEquipment(inventory.equipment, location, characterId, slot, instanceId, equipmentCatalog);
  if (!assigned.accepted) return rejected;
  const maxHp =
    assignedEquipmentStats(base, assigned.state, equipmentCatalog).maxHp +
    growthStats(characterId, game.growth, rules).maxHp;
  return {
    accepted: true as const,
    state: {
      ...game,
      inventory: { ...inventory, equipment: assigned.state },
      party: {
        ...game.party,
        members: game.party.members.map((m) =>
          m.id === characterId ? { ...m, hp: Math.min(m.hp, effectiveMaxHp(maxHp, m.status ?? healthyStatus())) } : m,
        ),
      },
    },
  };
}
