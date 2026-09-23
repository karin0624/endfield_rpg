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
  { key: "allyCenterX", label: "中心 左右", group: "味方の配置", min: -15, max: 15, step: 0.1 },
  { key: "allyCenterZ", label: "中心 前後", group: "味方の配置", min: -20, max: 15, step: 0.1 },
  { key: "allyStepX", label: "隣への左右差", group: "味方の配置", min: -10, max: 10, step: 0.1 },
  { key: "allyStepZ", label: "隣への前後差", group: "味方の配置", min: -10, max: 10, step: 0.1 },
  { key: "enemyCenterX", label: "中心 左右", group: "敵の配置", min: -15, max: 15, step: 0.1 },
  { key: "enemyCenterZ", label: "中心 前後", group: "敵の配置", min: -20, max: 15, step: 0.1 },
  { key: "enemyStepX", label: "隣への左右差", group: "敵の配置", min: -10, max: 10, step: 0.1 },
  { key: "enemyStepZ", label: "隣への前後差", group: "敵の配置", min: -10, max: 10, step: 0.1 },
] as const;

export type SettingKey = (typeof settingsFields)[number]["key"];
export type BattleSettings = { version: 2 } & Record<SettingKey, number>;
export const draftStorageKey = "endfield.battle-settings.draft.v1";

/** 旧形式のJSONへ追加する、今回導入した隊列ルールの既定値。 */
export type FormationSettingKey =
  | "allyCenterX"
  | "allyCenterZ"
  | "allyStepX"
  | "allyStepZ"
  | "enemyCenterX"
  | "enemyCenterZ"
  | "enemyStepX"
  | "enemyStepZ";

export const formationSettingDefaults: Record<FormationSettingKey, number> = {
  allyCenterX: 3.2,
  allyCenterZ: 1.5,
  allyStepX: -2.2,
  allyStepZ: 0,
  enemyCenterX: -3.2,
  enemyCenterZ: 0.5,
  enemyStepX: 1.8,
  enemyStepZ: 0,
};

const formationSettingKeys = Object.keys(formationSettingDefaults) as FormationSettingKey[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrateSettingsInput(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("構図の設定はオブジェクトで指定してください。");
  }
  if (value.version === 1) {
    // 旧v1の既存値はそのまま検証し、新項目だけを明示的に補う。
    const migrated: Record<string, unknown> = { ...value, version: 2 };
    for (const key of formationSettingKeys) {
      if (!(key in migrated)) migrated[key] = formationSettingDefaults[key];
    }
    return migrated;
  }
  if (value.version !== 2) throw new Error("対応していない構図設定の形式です。");
  return value;
}

export function parseBattleSettings(value: unknown): BattleSettings {
  const input = migrateSettingsInput(value);
  const result = { version: 2 } as BattleSettings;
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
  if (result.allyStepX === 0 && result.allyStepZ === 0) {
    throw new Error("味方の配置は2人が重ならないよう、左右差または前後差を指定してください。");
  }
  if (result.enemyStepX === 0 && result.enemyStepZ === 0) {
    throw new Error("敵の配置は2体が重ならないよう、左右差または前後差を指定してください。");
  }
  return result;
}
