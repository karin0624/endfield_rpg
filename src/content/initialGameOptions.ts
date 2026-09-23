import type { InitialGameOptions } from "../game/createInitialGameState";

export const initialGameOptions = {
  startingMode: "town",
  startingPlaceId: "town-square",
} satisfies InitialGameOptions;
