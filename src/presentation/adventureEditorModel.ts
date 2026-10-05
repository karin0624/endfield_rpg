import {
  type AdventureSettingKey,
  type AdventureSettings,
  adventureSettingsFields,
  parseAdventureSettings,
} from "./adventureSettings";

export type AdventureEditorFocus =
  | { readonly kind: "field"; readonly key: AdventureSettingKey; readonly control: "number" | "range" }
  | { readonly kind: "normal" | "preview" | "preview-back" | "save" | "revert" };
export interface AdventureEditorModel {
  readonly active: boolean;
  readonly saved: AdventureSettings;
  readonly current: AdventureSettings;
  readonly raw: Readonly<Record<AdventureSettingKey, string>>;
  readonly invalid: readonly AdventureSettingKey[];
  readonly validationMessage: string;
  readonly storageAvailable: boolean;
  readonly pendingSave: AdventureSettings | null;
  readonly preview: boolean;
  readonly focus: AdventureEditorFocus | null;
  readonly message: string;
  readonly error: boolean;
}
export type AdventureEditorEvent =
  | { readonly type: "field"; readonly key: AdventureSettingKey; readonly raw: string }
  | { readonly type: "draft-read"; readonly value: string | null; readonly available: boolean }
  | { readonly type: "storage-result"; readonly available: boolean }
  | { readonly type: "save" | "revert" | "preview" | "preview-back" | "closed" }
  | { readonly type: "save-success" | "save-failed"; readonly message: string }
  | { readonly type: "focused"; readonly target: AdventureEditorFocus }
  | { readonly type: "blurred"; readonly target: AdventureEditorFocus }
  | { readonly type: "key"; readonly key: string; readonly shift: boolean };
export type AdventureEditorEffect =
  | { readonly type: "preview-settings" | "write-draft" | "save"; readonly settings: AdventureSettings }
  | { readonly type: "delete-draft" };
const rawSettings = (settings: AdventureSettings) =>
  Object.fromEntries(adventureSettingsFields.map(({ key }) => [key, String(settings[key])])) as Record<
    AdventureSettingKey,
    string
  >;
function matches(a: AdventureSettings, b: AdventureSettings): boolean {
  return adventureSettingsFields.every(({ key }) => a[key] === b[key]);
}
export function createAdventureEditorModel(initial: AdventureSettings): AdventureEditorModel {
  return {
    active: true,
    saved: initial,
    current: initial,
    raw: rawSettings(initial),
    invalid: [],
    validationMessage: "",
    storageAvailable: true,
    pendingSave: null,
    preview: false,
    focus: null,
    message: "値を動かすと会話画面にすぐ反映されます。",
    error: false,
  };
}
export function projectAdventureEditor(state: AdventureEditorModel) {
  return {
    ...state,
    message: state.validationMessage || (state.pendingSave ? "標準として保存しています…" : state.message),
    error: !!state.validationMessage || state.error,
    canSave: state.active && !state.validationMessage && !state.pendingSave,
    inputsEnabled: state.active,
  };
}
function focusOrder(state: AdventureEditorModel): readonly AdventureEditorFocus[] {
  if (state.preview) return [{ kind: "preview-back" }];
  return [
    { kind: "normal" },
    { kind: "preview" },
    ...(projectAdventureEditor(state).canSave ? [{ kind: "save" as const }] : []),
    { kind: "revert" },
    ...adventureSettingsFields.flatMap(({ key }) => [
      { kind: "field" as const, key, control: "number" as const },
      { kind: "field" as const, key, control: "range" as const },
    ]),
  ];
}
export function reduceAdventureEditor(state: AdventureEditorModel, event: AdventureEditorEvent) {
  const result = (next = state, effects: readonly AdventureEditorEffect[] = [], handled = true) => ({
    state: next,
    effects,
    handled,
  });
  if (!state.active) return result(state, [], false);
  if (event.type === "closed") return result({ ...state, active: false, focus: null });
  if (event.type === "focused") return result({ ...state, focus: event.target });
  if (event.type === "blurred")
    return JSON.stringify(state.focus) === JSON.stringify(event.target)
      ? result({ ...state, focus: null })
      : result(state, [], false);
  if (event.type === "key") {
    if (event.key !== "Tab" || !state.focus) return result(state, [], false);
    const order = focusOrder(state),
      current = order.findIndex((target) => JSON.stringify(target) === JSON.stringify(state.focus));
    const index = current < 0 ? (event.shift ? order.length - 1 : 0) : current + (event.shift ? -1 : 1);
    return result({ ...state, focus: order[index] ?? null }, [], index >= 0 && index < order.length);
  }
  if (event.type === "preview" || event.type === "preview-back")
    return result({
      ...state,
      preview: event.type === "preview",
      focus: { kind: event.type === "preview" ? "preview-back" : "preview" },
    });
  if (event.type === "storage-result")
    return result({
      ...state,
      storageAvailable: event.available,
      message:
        state.message === "未保存の調整です。このブラウザに一時保存しています。" ||
        state.message === "調整は反映されていますが、このブラウザへの一時保存はできません。"
          ? event.available
            ? "未保存の調整です。このブラウザに一時保存しています。"
            : "調整は反映されていますが、このブラウザへの一時保存はできません。"
          : state.message,
    });
  if (event.type === "draft-read") {
    let next = { ...state, storageAvailable: event.available };
    if (!event.available)
      next = { ...next, message: "前回の調整を読み取れなかったため、保存済みの標準を表示しています。" };
    if (event.value !== null) {
      try {
        const current = parseAdventureSettings(JSON.parse(event.value));
        next = { ...next, current, raw: rawSettings(current), message: "前回の未保存の調整を復元しました。" };
      } catch {
        return result({ ...next, message: "前回の調整を読み取れなかったため、保存済みの標準を表示しています。" }, [
          { type: "preview-settings", settings: state.saved },
        ]);
      }
    }
    return result(next, [{ type: "preview-settings", settings: next.current }]);
  }
  if (event.type === "field") {
    const raw = { ...state.raw, [event.key]: event.raw },
      invalid = adventureSettingsFields
        .filter(
          ({ key, min, max }) =>
            raw[key].trim() === "" ||
            !Number.isFinite(Number(raw[key])) ||
            Number(raw[key]) < min ||
            Number(raw[key]) > max,
        )
        .map(({ key }) => key);
    try {
      const current = parseAdventureSettings({
        version: 1,
        ...Object.fromEntries(
          adventureSettingsFields.map(({ key }) => [key, raw[key].trim() === "" ? NaN : Number(raw[key])]),
        ),
      });
      return result(
        {
          ...state,
          current,
          raw,
          invalid: [],
          validationMessage: "",
          error: false,
          message: state.storageAvailable
            ? "未保存の調整です。このブラウザに一時保存しています。"
            : "調整は反映されていますが、このブラウザへの一時保存はできません。",
        },
        [
          { type: "preview-settings", settings: current },
          { type: "write-draft", settings: current },
        ],
      );
    } catch (error) {
      return result({ ...state, raw, invalid, validationMessage: (error as Error).message });
    }
  }
  if (event.type === "revert")
    return result(
      {
        ...state,
        current: state.saved,
        raw: rawSettings(state.saved),
        invalid: [],
        validationMessage: "",
        error: false,
        message: "保存済みの標準に戻しました。",
      },
      [{ type: "preview-settings", settings: state.saved }, { type: "delete-draft" }],
    );
  if (event.type === "save" && projectAdventureEditor(state).canSave)
    return result({ ...state, pendingSave: state.current, error: false }, [{ type: "save", settings: state.current }]);
  if ((event.type === "save-success" || event.type === "save-failed") && state.pendingSave) {
    const saved = event.type === "save-success" ? state.pendingSave : state.saved;
    return result(
      { ...state, saved, pendingSave: null, message: event.message, error: event.type === "save-failed" },
      event.type === "save-success"
        ? matches(state.current, saved)
          ? [{ type: "delete-draft" }]
          : [{ type: "write-draft", settings: state.current }]
        : [],
    );
  }
  return result(state, [], false);
}
