import type { ExpeditionGame } from "../game/expedition";
import { canSaveGame, deserializeGame, type SaveDefinitions, serializeGame } from "../game/save";

export const GAME_SAVE_KEY = "endfield-rpg-game-save";
export const DEBUG_SAVE_KEY = "endfield-rpg-debug-save";
type StorageAccess = () => Pick<Storage, "getItem" | "setItem">;
const browserStorage: StorageAccess = () => window.localStorage;

export function writeSlot(
  game: ExpeditionGame,
  definitions: SaveDefinitions,
  storage: StorageAccess = browserStorage,
  key = GAME_SAVE_KEY,
): { readonly saved: boolean; readonly message: string } {
  const result = serializeGame(game, definitions);
  if (!result.accepted)
    return {
      saved: false,
      message: result.reason === "not-in-town" ? "街に戻ってから保存してください。" : "保存できませんでした。",
    };
  try {
    storage().setItem(key, result.data);
  } catch {
    return { saved: false, message: "保存できませんでした。ブラウザの保存領域を確認してください。" };
  }
  return { saved: true, message: "保存しました。" };
}

export function loadSlot(
  game: ExpeditionGame,
  definitions: SaveDefinitions,
  storage: StorageAccess = browserStorage,
  key = GAME_SAVE_KEY,
): { readonly message: string; readonly state?: ExpeditionGame } {
  if (!canSaveGame(game)) return { message: "街に戻ってから読み込んでください。" };
  let data: string | null;
  try {
    data = storage().getItem(key);
  } catch {
    return { message: "読み込めませんでした。ブラウザの保存領域を確認してください。" };
  }
  if (data === null) return { message: "保存データがありません。" };
  const result = deserializeGame(data, definitions);
  if (!result.accepted)
    return {
      message:
        result.reason === "unsupported-version"
          ? "対応していない保存データです。"
          : "保存データを読み込めませんでした。",
    };
  return { state: result.state, message: "読み込みました。" };
}

export function saveSlot(
  game: ExpeditionGame,
  definitions: SaveDefinitions,
  storage: StorageAccess = browserStorage,
  key = GAME_SAVE_KEY,
): string {
  return writeSlot(game, definitions, storage, key).message;
}
