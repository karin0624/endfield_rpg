export const GAME_SAVE_KEY = "endfield-rpg-game-save";
export const DEBUG_SAVE_KEY = "endfield-rpg-debug-save";
type StorageAccess = () => Pick<Storage, "getItem" | "setItem">;
const browserStorage: StorageAccess = () => window.localStorage;

/** Browser I/O receives already-confirmed bytes; acceptance and parsing belong to the model. */
export function writeSlotData(data: string, storage: StorageAccess = browserStorage, key = GAME_SAVE_KEY): boolean {
  try {
    storage().setItem(key, data);
    return true;
  } catch {
    return false;
  }
}
export function readSlotData(
  storage: StorageAccess = browserStorage,
  key = GAME_SAVE_KEY,
): { readonly data: string | null } | { readonly error: true } {
  try {
    return { data: storage().getItem(key) };
  } catch {
    return { error: true };
  }
}
