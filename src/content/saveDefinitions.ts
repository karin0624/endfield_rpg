import type { SaveDefinitions } from "../game/save";
import { characters } from "./characters";
import { initialAdventure } from "./initialAdventure";

export const saveDefinitions: SaveDefinitions = {
  characters,
  placeIds: initialAdventure.places.map(({ id }) => id),
  recruitmentFlags: [{ flag: "joined-gilberta", characterId: "gilberta" }],
};
