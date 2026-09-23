export type GameMode = "town";

export interface InitialGameOptions {
  startingMode: GameMode;
}

export interface GameState {
  mode: GameMode;
  flags: string[];
}

export function createInitialGameState(options: InitialGameOptions): GameState {
  return {
    mode: options.startingMode,
    flags: [],
  };
}
