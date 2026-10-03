import { equipmentCatalog } from "../content/equipmentDefinitions";
import type { EquipmentInstance, EquipmentLoadout, SharedEquipment } from "./equipment";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  return Object.keys(value).length === expected.length && expected.every((k) => Object.hasOwn(value, k));
}
export function parseSavedEquipment(value: unknown): SharedEquipment | undefined {
  if (
    !record(value) ||
    !keys(value, ["owned", "assignments"]) ||
    !Array.isArray(value.owned) ||
    !Array.isArray(value.assignments)
  )
    return;
  const owned: EquipmentInstance[] = [];
  for (const e of value.owned) {
    if (
      !record(e) ||
      !keys(e, ["instanceId", "definitionId"]) ||
      typeof e.instanceId !== "string" ||
      !e.instanceId.trim() ||
      typeof e.definitionId !== "string" ||
      !equipmentCatalog.some((d) => d.id === e.definitionId) ||
      owned.some((d) => d.instanceId === e.instanceId)
    )
      return;
    owned.push({ instanceId: e.instanceId, definitionId: e.definitionId });
  }
  const assignments: ({ characterId: string } & EquipmentLoadout)[] = [];
  const used = new Set<string>();
  for (const a of value.assignments) {
    if (
      !record(a) ||
      !keys(a, ["characterId", "weapon", "armor"]) ||
      typeof a.characterId !== "string" ||
      assignments.some((d) => d.characterId === a.characterId)
    )
      return;
    for (const slot of ["weapon", "armor"] as const) {
      const id = a[slot];
      if (id === null) continue;
      if (typeof id !== "string" || used.has(id)) return;
      const instance = owned.find((e) => e.instanceId === id);
      if (!instance || !equipmentCatalog.some((d) => d.id === instance.definitionId && d.slot === slot)) return;
      used.add(id);
    }
    assignments.push({
      characterId: a.characterId,
      weapon: a.weapon as string | null,
      armor: a.armor as string | null,
    });
  }
  return { owned, assignments };
}
