// ブラウザUI・開発サーバーで共用。Babylon.jsやDOMを読み込まない。
export const settingsFields = [
  { key: "cameraX", label: "カメラ 左右", group: "カメラの初期位置", min: -20, max: 20, step: 0.1 },
  { key: "cameraY", label: "カメラ 高さ", group: "カメラの初期位置", min: 1, max: 30, step: 0.1 },
  { key: "cameraZ", label: "カメラ 前後", group: "カメラの初期位置", min: 2, max: 50, step: 0.1 },
  { key: "targetX", label: "注視点 左右", group: "視線の先", min: -15, max: 15, step: 0.1 },
  { key: "targetY", label: "注視点 高さ", group: "視線の先", min: -5, max: 15, step: 0.1 },
  { key: "targetZ", label: "注視点 前後", group: "視線の先", min: -20, max: 15, step: 0.1 },
  { key: "fovDegrees", label: "画角（度）", group: "視線の先", min: 20, max: 90, step: 0.1 },
  { key: "groundScale", label: "地面の倍率", group: "地面", min: 0.5, max: 2.5, step: 0.01 },
  { key: "backdropScale", label: "遠景の倍率", group: "遠景", min: 0.5, max: 3, step: 0.01 },
  { key: "backdropX", label: "遠景 左右", group: "遠景", min: -40, max: 40, step: 0.1 },
  { key: "backdropY", label: "遠景 高さ", group: "遠景", min: -15, max: 40, step: 0.1 },
  { key: "backdropZ", label: "遠景 前後", group: "遠景", min: -60, max: 10, step: 0.1 },
] as const;

export type SettingKey = typeof settingsFields[number]["key"];
export type BattleSettings = { version: 1 } & Record<SettingKey, number>;
export const draftStorageKey = "endfield.battle-settings.draft.v1";

export function parseBattleSettings(value: unknown): BattleSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("構図の設定はオブジェクトで指定してください。");
  }
  const input = value as Record<string, unknown>;
  if (input.version !== 1) throw new Error("対応していない構図設定の形式です。");
  const result = { version: 1 } as BattleSettings;
  for (const field of settingsFields) {
    const number = input[field.key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < field.min || number > field.max) {
      throw new Error(`${field.label}は${field.min}〜${field.max}で指定してください。`);
    }
    result[field.key] = number;
  }
  // 注視点との一致・真上/真下向きによる不定な視点を避ける。
  if (Math.hypot(result.cameraX - result.targetX, result.cameraZ - result.targetZ) < 0.5) {
    throw new Error("カメラと注視点は、左右または前後に0.5以上離してください。");
  }
  return result;
}
