export const adventureSettingsFields = [
  { key: "leftX", label: "左の水平位置 (%)", group: "立ち絵・横画面", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "centerX", label: "中央の水平位置 (%)", group: "立ち絵・横画面", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "rightX", label: "右の水平位置 (%)", group: "立ち絵・横画面", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "portraitBottom", label: "足元の高さ (%)", group: "立ち絵・横画面", min: 0, max: 70, step: 0.5, unit: "%" },
  {
    key: "portraitHeight",
    label: "全員共通の高さ (%)",
    group: "立ち絵・横画面",
    min: 20,
    max: 130,
    step: 0.5,
    unit: "%",
  },
  { key: "mobileLeftX", label: "左の水平位置 (%)", group: "立ち絵・縦画面", min: 0, max: 100, step: 0.5, unit: "%" },
  {
    key: "mobileCenterX",
    label: "中央の水平位置 (%)",
    group: "立ち絵・縦画面",
    min: 0,
    max: 100,
    step: 0.5,
    unit: "%",
  },
  { key: "mobileRightX", label: "右の水平位置 (%)", group: "立ち絵・縦画面", min: 0, max: 100, step: 0.5, unit: "%" },
  {
    key: "mobilePortraitBottom",
    label: "足元の高さ (%)",
    group: "立ち絵・縦画面",
    min: 0,
    max: 70,
    step: 0.5,
    unit: "%",
  },
  {
    key: "mobilePortraitHeight",
    label: "全員共通の高さ (%)",
    group: "立ち絵・縦画面",
    min: 20,
    max: 130,
    step: 0.5,
    unit: "%",
  },
  {
    key: "panelHeight",
    label: "本文エリアの最小高さ (%)",
    group: "本文エリア",
    min: 15,
    max: 75,
    step: 0.5,
    unit: "%",
  },
  {
    key: "mobilePanelHeight",
    label: "縦画面の最小高さ (%)",
    group: "本文エリア",
    min: 15,
    max: 75,
    step: 0.5,
    unit: "%",
  },
  { key: "panelPaddingX", label: "左右の余白 (%)", group: "本文エリア", min: 0, max: 25, step: 0.5, unit: "%" },
  {
    key: "mobilePanelPaddingX",
    label: "縦画面の左右余白 (%)",
    group: "本文エリア",
    min: 0,
    max: 25,
    step: 0.5,
    unit: "%",
  },
  { key: "panelPaddingTop", label: "上の余白 (px)", group: "本文エリア", min: 0, max: 100, step: 1, unit: "px" },
  {
    key: "mobilePanelPaddingTop",
    label: "縦画面の上余白 (px)",
    group: "本文エリア",
    min: 0,
    max: 100,
    step: 1,
    unit: "px",
  },
  { key: "speakerGap", label: "話者名の下余白 (px)", group: "本文エリア", min: 0, max: 80, step: 1, unit: "px" },
  { key: "textGap", label: "罫線と本文の間隔 (px)", group: "本文エリア", min: 0, max: 80, step: 1, unit: "px" },
  { key: "arrowRight", label: "送り矢印の右位置 (%)", group: "本文エリア", min: 0, max: 25, step: 0.5, unit: "%" },
  { key: "arrowBottom", label: "送り矢印の下位置 (px)", group: "本文エリア", min: 0, max: 100, step: 1, unit: "px" },
  { key: "choicesTop", label: "選択肢の中心高さ (%)", group: "選択肢", min: 10, max: 90, step: 0.5, unit: "%" },
  { key: "choicesWidth", label: "選択肢の幅 (%)", group: "選択肢", min: 30, max: 100, step: 0.5, unit: "%" },
  { key: "mobileChoicesTop", label: "縦画面の中心高さ (%)", group: "選択肢", min: 10, max: 90, step: 0.5, unit: "%" },
  { key: "mobileChoicesWidth", label: "縦画面の幅 (%)", group: "選択肢", min: 30, max: 100, step: 0.5, unit: "%" },
] as const;

export type AdventureSettingKey = (typeof adventureSettingsFields)[number]["key"];
export type AdventureSettings = { version: 1 } & Record<AdventureSettingKey, number>;
export const adventureDraftStorageKey = "endfield.adventure-settings.draft.v1";

export function parseAdventureSettings(value: unknown): AdventureSettings {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("version" in value) ||
    value.version !== 1
  ) {
    throw new Error("対応していない会話画面設定です。");
  }
  const input = value as Record<string, unknown>;
  const result = { version: 1 } as AdventureSettings;
  for (const field of adventureSettingsFields) {
    const number = input[field.key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < field.min || number > field.max) {
      throw new Error(`${field.label}は${field.min}〜${field.max}で指定してください。`);
    }
    result[field.key] = number;
  }
  return result;
}
