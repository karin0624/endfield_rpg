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

export interface EquipmentInstance {
  readonly instanceId: string;
  readonly definitionId: string;
}
export interface SharedEquipment {
  readonly owned: readonly EquipmentInstance[];
  readonly assignments: readonly ({ readonly characterId: string } & EquipmentLoadout)[];
}
/** Loadout slots store shared physical instance IDs. */
export function assignEquipment(
  state: SharedEquipment,
  location: "home" | "exploration",
  characterId: string,
  slot: EquipmentSlot,
  instanceId: string | null,
  catalog: readonly EquipmentDefinition[],
): { readonly accepted: boolean; readonly state: SharedEquipment } {
  if (location !== "home") return { accepted: false, state };
  if (instanceId !== null) {
    const instance = state.owned.find((e) => e.instanceId === instanceId);
    if (
      !instance ||
      !catalog.some((e) => e.id === instance.definitionId && e.slot === slot) ||
      state.assignments.some(
        (a) => a.characterId !== characterId && (a.weapon === instanceId || a.armor === instanceId),
      )
    )
      return { accepted: false, state };
  }
  const previous = state.assignments.find((a) => a.characterId === characterId) ?? { characterId, ...emptyEquipment };
  return {
    accepted: true,
    state: {
      ...state,
      assignments: [
        ...state.assignments.filter((a) => a.characterId !== characterId),
        { ...previous, [slot]: instanceId },
      ],
    },
  };
}
export function assignedEquipmentStats(
  base: CharacterDefinition,
  state: SharedEquipment,
  catalog: readonly EquipmentDefinition[],
): CharacterDefinition {
  const assignment = state.assignments.find((a) => a.characterId === base.id) ?? emptyEquipment;
  const definitionId = (instanceId: string | null) => {
    if (instanceId === null) return null;
    const instance = state.owned.find((e) => e.instanceId === instanceId);
    if (!instance) throw new Error("所持していない装備です");
    return instance.definitionId;
  };
  return equipmentStats(
    base,
    { weapon: definitionId(assignment.weapon), armor: definitionId(assignment.armor) },
    catalog,
  );
}
