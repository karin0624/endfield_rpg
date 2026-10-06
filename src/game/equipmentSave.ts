import * as v from "valibot";
import { equipmentCatalog } from "../content/equipmentDefinitions";
import type { SharedEquipment } from "./equipment";

export const savedEquipment = v.strictObject({
  owned: v.array(
    v.strictObject({
      instanceId: v.pipe(
        v.string(),
        v.check((id) => id.trim().length > 0),
      ),
      definitionId: v.string(),
    }),
  ),
  assignments: v.array(
    v.strictObject({
      characterId: v.string(),
      weapon: v.nullable(v.string()),
      armor: v.nullable(v.string()),
    }),
  ),
});

/** The format is already checked; validate definitions, ownership and slot exclusivity. */
export function restoreSavedEquipment(value: v.InferOutput<typeof savedEquipment>): SharedEquipment | undefined {
  const { owned, assignments } = value;
  if (
    new Set(owned.map((entry) => entry.instanceId)).size !== owned.length ||
    owned.some((entry) => !equipmentCatalog.some((definition) => definition.id === entry.definitionId)) ||
    new Set(assignments.map((entry) => entry.characterId)).size !== assignments.length
  )
    return;
  const used = new Set<string>();
  for (const assignment of assignments) {
    for (const slot of ["weapon", "armor"] as const) {
      const id = assignment[slot];
      if (id === null) continue;
      if (used.has(id)) return;
      const instance = owned.find((entry) => entry.instanceId === id);
      if (
        !instance ||
        !equipmentCatalog.some((definition) => definition.id === instance.definitionId && definition.slot === slot)
      )
        return;
      used.add(id);
    }
  }
  return value;
}
