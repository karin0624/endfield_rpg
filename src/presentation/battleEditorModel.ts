import { initialBattleCombatants } from "../content/initialBattle";
import { type GroundingSample, projectActorPlacements } from "./battleLayout";
import { projectInitialBattleActors } from "./battleProjection";
import { type BattleSettings, parseBattleSettings, type SettingKey, settingsFields } from "./battleSettings";

export type BattleEditorFocus =
  | { readonly kind: "field"; readonly key: SettingKey; readonly control: "number" | "range" }
  | {
      readonly kind:
        | "normal"
        | "preview"
        | "preview-back"
        | "save"
        | "revert"
        | "export"
        | "ally-count"
        | "enemy-count";
    };
export interface BattleEditorModel {
  readonly active: boolean;
  readonly saved: BattleSettings;
  readonly current: BattleSettings;
  readonly raw: Readonly<Record<SettingKey, string>>;
  readonly invalid: readonly SettingKey[];
  readonly validationMessage: string;
  readonly storageAvailable: boolean;
  readonly pendingSave: BattleSettings | null;
  readonly grounding: "pending" | "settled";
  readonly warnings: readonly string[];
  readonly preview: boolean;
  readonly counts: { readonly ally: 1 | 2; readonly enemy: 1 | 2 };
  readonly focus: BattleEditorFocus | null;
  readonly message: string;
  readonly error: boolean;
}
export type BattleEditorEvent =
  | { readonly type: "field"; readonly key: SettingKey; readonly raw: string }
  | { readonly type: "draft-read"; readonly value: string | null; readonly available: boolean }
  | { readonly type: "storage-failed" }
  | { readonly type: "grounding"; readonly pending: boolean; readonly measurements: readonly GroundingSample[] }
  | { readonly type: "save" | "revert" | "export" | "preview" | "preview-back" | "closed" }
  | { readonly type: "save-success" | "save-failed"; readonly message: string }
  | { readonly type: "count"; readonly team: "ally" | "enemy"; readonly count: 1 | 2 }
  | { readonly type: "focused"; readonly target: BattleEditorFocus }
  | { readonly type: "blurred"; readonly target: BattleEditorFocus }
  | { readonly type: "key"; readonly key: string; readonly shift: boolean };
export type BattleEditorEffect =
  | { readonly type: "preview-settings" | "write-draft" | "save"; readonly settings: BattleSettings }
  | { readonly type: "delete-draft" }
  | { readonly type: "preview-counts"; readonly counts: BattleEditorModel["counts"] }
  | { readonly type: "export"; readonly json: string };
const rawSettings = (settings: BattleSettings) =>
  Object.fromEntries(settingsFields.map(({ key }) => [key, String(settings[key])])) as Record<SettingKey, string>;
export function createBattleEditorModel(initial: BattleSettings): BattleEditorModel {
  return {
    active: true,
    saved: initial,
    current: initial,
    raw: rawSettings(initial),
    invalid: [],
    validationMessage: "",
    storageAvailable: true,
    pendingSave: null,
    grounding: "settled",
    warnings: [],
    preview: false,
    counts: { ally: 2, enemy: 2 },
    focus: null,
    message: "調整はプレビューに即時反映されます。標準として保存すると通常表示にも反映されます。",
    error: false,
  };
}
export function projectBattleEditor(state: BattleEditorModel) {
  const placements = projectActorPlacements(initialBattleCombatants, state.current, state.counts);
  const message =
    state.validationMessage ||
    (state.pendingSave
      ? "標準として保存しています…"
      : state.grounding === "pending"
        ? "配置を反映しました。接地を確認しています…"
        : state.warnings.length
          ? `保存できません: ${state.warnings.join(" ")}`
          : state.message);
  return {
    ...state,
    placements,
    actors: projectInitialBattleActors(initialBattleCombatants).map((actor, index) => ({
      ...actor,
      visible: placements[index].visible,
    })),
    message,
    error: !!state.validationMessage || state.warnings.length > 0 || state.error,
    canSave:
      state.active &&
      !state.pendingSave &&
      !state.validationMessage &&
      state.grounding === "settled" &&
      !state.warnings.length,
    canExport: state.active && !state.validationMessage,
    canRevert: state.active && !state.pendingSave,
    inputsEnabled: state.active && !state.pendingSave,
  };
}
function focusOrder(state: BattleEditorModel): readonly BattleEditorFocus[] {
  if (state.preview) return [{ kind: "preview-back" }];
  const frame = projectBattleEditor(state);
  return [
    { kind: "normal" },
    { kind: "preview" },
    ...(frame.canSave ? [{ kind: "save" as const }] : []),
    { kind: "ally-count" },
    { kind: "enemy-count" },
    ...(!state.pendingSave ? [{ kind: "revert" as const }] : []),
    ...(frame.canExport ? [{ kind: "export" as const }] : []),
    ...(!state.pendingSave
      ? settingsFields.flatMap(({ key }) => [
          { kind: "field" as const, key, control: "number" as const },
          { kind: "field" as const, key, control: "range" as const },
        ])
      : []),
  ];
}
export function reduceBattleEditor(state: BattleEditorModel, event: BattleEditorEvent) {
  const result = (next = state, effects: readonly BattleEditorEffect[] = [], handled = true) => ({
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
    const order = focusOrder(state);
    const current = order.findIndex((target) => JSON.stringify(target) === JSON.stringify(state.focus));
    const index = current < 0 ? (event.shift ? order.length - 1 : 0) : current + (event.shift ? -1 : 1);
    return result({ ...state, focus: order[index] ?? null }, [], index >= 0 && index < order.length);
  }
  if (event.type === "preview" || event.type === "preview-back")
    return result({
      ...state,
      preview: event.type === "preview",
      focus: { kind: event.type === "preview" ? "preview-back" : "preview" },
    });
  if (event.type === "count") {
    const counts = { ...state.counts, [event.team]: event.count };
    return result({ ...state, counts }, [{ type: "preview-counts", counts }]);
  }
  if (event.type === "storage-failed")
    return result({
      ...state,
      storageAvailable: false,
      message:
        state.message === "未保存の調整です。このブラウザに一時保存しています。"
          ? "未保存の調整です。一時保存が使えないため、閉じる前に標準として保存してください。"
          : state.message,
    });
  if (event.type === "grounding")
    return result({
      ...state,
      grounding: event.pending ? "pending" : "settled",
      warnings: event.measurements
        .filter(({ groundY }) => groundY === null)
        .map(({ id }) => `${id}の足元が地面の範囲外です。配置を調整してください。`),
    });
  if (event.type === "draft-read") {
    let next = { ...state, storageAvailable: event.available };
    if (event.value) {
      try {
        const current = parseBattleSettings(JSON.parse(event.value));
        next = { ...next, current, raw: rawSettings(current), message: "前回の未保存の調整を復元しました。" };
      } catch {
        return result({ ...next, message: "前回の調整を読み取れなかったため、保存済みの標準を表示しています。" }, [
          { type: "delete-draft" },
          { type: "preview-settings", settings: state.saved },
        ]);
      }
    }
    return result(next, [{ type: "preview-settings", settings: next.current }]);
  }
  if (event.type === "field") {
    if (state.pendingSave) return result(state, [], false);
    const raw = { ...state.raw, [event.key]: event.raw };
    const invalid = settingsFields
      .filter(
        ({ key, min, max }) =>
          raw[key].trim() === "" ||
          !Number.isFinite(Number(raw[key])) ||
          Number(raw[key]) < min ||
          Number(raw[key]) > max,
      )
      .map(({ key }) => key);
    const candidate = {
      version: 2,
      ...Object.fromEntries(settingsFields.map(({ key }) => [key, raw[key].trim() === "" ? NaN : Number(raw[key])])),
    };
    try {
      const current = parseBattleSettings(candidate);
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
            : "未保存の調整です。一時保存が使えないため、閉じる前に標準として保存してください。",
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
  if (event.type === "revert" && !state.pendingSave)
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
  if (event.type === "save" && projectBattleEditor(state).canSave)
    return result({ ...state, pendingSave: state.current, error: false }, [{ type: "save", settings: state.current }]);
  if (event.type === "export" && projectBattleEditor(state).canExport)
    return result(state, [{ type: "export", json: `${JSON.stringify(state.current, null, 2)}\n` }]);
  if ((event.type === "save-success" || event.type === "save-failed") && state.pendingSave) {
    const saved = event.type === "save-success" ? state.pendingSave : state.saved;
    return result(
      { ...state, saved, pendingSave: null, message: event.message, error: event.type === "save-failed" },
      event.type === "save-success" ? [{ type: "delete-draft" }] : [],
    );
  }
  return result(state, [], false);
}
