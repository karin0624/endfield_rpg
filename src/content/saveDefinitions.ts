import type { SaveDefinitions } from "../game/save";
import { characters } from "./characters";
import { growthRules } from "./growthRules";
import { initialAdventure } from "./initialAdventure";
import { mentalFatigueDefinition } from "./mentalFatigueDefinition";
import { skillCatalog } from "./skillDefinitions";

export const saveDefinitions: SaveDefinitions = {
  characters,
  skills: { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules },
  placeIds: initialAdventure.places.map(({ id }) => id),
  recruitmentFlags: [{ flag: "joined-gilberta", characterId: "gilberta" }],
};
