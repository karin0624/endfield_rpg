export type GameMode = "town" | "conversation";

export interface InitialGameOptions {
  startingMode: "town";
  startingPlaceId: string;
}

export interface GameState {
  mode: GameMode;
  currentPlaceId: string;
  conversationId: string | null;
  conversationPosition: string | null;
  flags: readonly string[];
}

export function createInitialGameState(options: InitialGameOptions): GameState {
  return {
    mode: options.startingMode,
    currentPlaceId: options.startingPlaceId,
    conversationId: null,
    conversationPosition: null,
    flags: [],
  };
}
