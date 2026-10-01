import type { ExpeditionGame } from "../game/expedition";
import { canSaveGame, deserializeGame, type SaveDefinitions, serializeGame } from "../game/save";

export const GAME_SAVE_KEY = "endfield-rpg-game-save";
type StorageAccess = () => Pick<Storage, "getItem" | "setItem">;
const browserStorage: StorageAccess = () => window.localStorage;

export function saveSlot(
  game: ExpeditionGame,
  definitions: SaveDefinitions,
  storage: StorageAccess = browserStorage,
): string {
  const result = serializeGame(game, definitions);
  if (!result.accepted)
    return result.reason === "not-in-town" ? "街に戻ってから保存してください。" : "保存できませんでした。";
  try {
    storage().setItem(GAME_SAVE_KEY, result.data);
  } catch {
    return "保存できませんでした。ブラウザの保存領域を確認してください。";
  }
  return "保存しました。";
}

export function loadSlot(
  game: ExpeditionGame,
  definitions: SaveDefinitions,
  storage: StorageAccess = browserStorage,
): { readonly message: string; readonly state?: ExpeditionGame } {
  if (!canSaveGame(game)) return { message: "街に戻ってから読み込んでください。" };
  let data: string | null;
  try {
    data = storage().getItem(GAME_SAVE_KEY);
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
