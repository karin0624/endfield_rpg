import type { CharacterDefinition } from "./party";

export type EquipmentSlot = "weapon" | "armor";
export interface EquipmentDefinition {
  readonly id: string;
  readonly slot: EquipmentSlot;
  /** Additive trial effects on existing stats; no defence stat or skill gating. */
  readonly bonuses: { readonly maxHp: number; readonly attackPower: number };
}
export interface EquipmentLoadout {
  readonly weapon: string | null;
  readonly armor: string | null;
}
export const emptyEquipment: EquipmentLoadout = { weapon: null, armor: null };

/** Ownership/availability is supplied by the caller, without choosing a shared/personal economy. */
export function changeEquipment(
  loadout: EquipmentLoadout,
  location: "home" | "exploration",
  slot: EquipmentSlot,
  equipmentId: string | null,
  availableIds: readonly string[],
  catalog: readonly EquipmentDefinition[],
): { readonly accepted: boolean; readonly loadout: EquipmentLoadout } {
  if (location !== "home") return { accepted: false, loadout };
  if (
    equipmentId !== null &&
    (!availableIds.includes(equipmentId) || !catalog.some((e) => e.id === equipmentId && e.slot === slot))
  )
    return { accepted: false, loadout };
  return { accepted: true, loadout: { ...loadout, [slot]: equipmentId } };
}
/** Always project from the unmodified base; never feed a previous projection back in. */
export function equipmentStats(
  base: CharacterDefinition,
  loadout: EquipmentLoadout,
  catalog: readonly EquipmentDefinition[],
): CharacterDefinition {
  let maxHp = base.maxHp;
  let attackPower = base.attackPower;
  for (const slot of ["weapon", "armor"] as const) {
    const id = loadout[slot];
    if (id === null) continue;
    const equipment = catalog.find((e) => e.id === id && e.slot === slot);
    if (!equipment) throw new Error("装備定義がありません");
    maxHp += equipment.bonuses.maxHp;
    attackPower += equipment.bonuses.attackPower;
  }
  if (!Number.isFinite(maxHp) || maxHp <= 0 || !Number.isFinite(attackPower) || attackPower < 0)
    throw new Error("装備補正後の能力値が不正です");
  return { ...base, maxHp, attackPower };
}
