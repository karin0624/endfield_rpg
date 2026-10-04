import {
  type BattleEditorEvent,
  type BattleEditorFocus,
  createBattleEditorModel,
  projectBattleEditor,
  reduceBattleEditor,
} from "../presentation/battleEditorModel";
import { type BattleSettings, draftStorageKey, type SettingKey, settingsFields } from "../presentation/battleSettings";
import type { createBattleScene } from "./battleScene";
import { requiredElement } from "./requiredElement";

export function createBattleEditorView(
  app: HTMLDivElement,
  emit: (event: BattleEditorEvent) => boolean,
  finishGrounding: () => void = () => {},
) {
  const groups = [...new Set(settingsFields.map((field) => field.group))];
  const header = document.createElement("header");
  header.className = "editor-header";
  header.innerHTML = `<div><p class="eyebrow">DEVELOPMENT / COMPOSITION</p><h1>戦闘画面の構図</h1></div>
    <div class="header-actions"><a href="${import.meta.env.BASE_URL}?debug=1&battle=1">保存済みの通常表示</a><button type="button" data-preview>画面だけで確認</button></div>`;
  const panel = document.createElement("aside");
  panel.className = "editor-panel";
  panel.setAttribute("aria-label", "構図設定");
  panel.innerHTML = `
    <div class="save-panel">
      <button type="button" class="primary" data-save>標準として保存</button>
      <div class="preview-counts" aria-label="確認人数">
        <span>確認人数：</span>
        <label>味方<select data-preview-ally-count aria-label="味方の確認人数"><option value="1">1</option><option value="2" selected>2</option></select></label>
        <span>・</span>
        <label>敵<select data-preview-enemy-count aria-label="敵の確認人数"><option value="1">1</option><option value="2" selected>2</option></select></label>
      </div>
      <p class="field-help preview-count-help">確認人数を変えても、編集中の配置ルールはその陣営の全人数に適用されます。</p>
      <p class="editor-message" role="status" data-message></p>
      <div class="secondary-actions"><button type="button" data-revert>保存済みに戻す</button><button type="button" data-export>JSONを書き出す</button></div>
    </div>
    <div class="settings-fields">${groups
      .map(
        (group) => `
      <fieldset><legend>${group}</legend>
        ${settingsFields
          .filter((field) => field.group === group)
          .map(
            (field) => `
          <div class="setting-field">
            <label for="${field.key}-number">${field.label}</label>
            <input id="${field.key}-number" data-key="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" />
            <input aria-label="${field.label} スライダー" data-key="${field.key}" type="range" min="${field.min}" max="${field.max}" step="${field.step}" />
          </div>`,
          )
          .join("")}
        ${group === "地面" ? '<p class="field-help">立ち位置は地面上の同じ地点に追従します。立ち絵の大きさは変わりません。</p>' : ""}
        ${group === "遠景" ? '<p class="field-help">高さ・前後で地面との重なりを調整します。縦横比は固定です。前後は小さい値ほど奥へ動きます。</p>' : ""}
        ${group === "味方の配置" || group === "敵の配置" ? '<p class="field-help">中心を固定し、人数に応じて隣への差分で均等に並べます。高さは地面から自動取得します。</p>' : ""}
      </fieldset>`,
      )
      .join("")}</div>`;
  const previewBack = document.createElement("button");
  previewBack.type = "button";
  previewBack.className = "preview-back";
  previewBack.textContent = "設定に戻る";
  app.prepend(header);
  requiredElement<HTMLElement>(app, "main").append(panel);
  app.append(previewBack);

  const events = new AbortController();
  const inputs = [...panel.querySelectorAll<HTMLInputElement>("input")];
  const message = requiredElement<HTMLParagraphElement>(panel, "[data-message]");
  const save = requiredElement<HTMLButtonElement>(panel, "[data-save]");
  const revert = requiredElement<HTMLButtonElement>(panel, "[data-revert]");
  const exporter = requiredElement<HTMLButtonElement>(panel, "[data-export]");
  const allyCount = requiredElement<HTMLSelectElement>(panel, "[data-preview-ally-count]");
  const enemyCount = requiredElement<HTMLSelectElement>(panel, "[data-preview-enemy-count]");
  const preview = requiredElement<HTMLButtonElement>(header, "[data-preview]");
  const handles = new Map<string, HTMLElement>();
  function register(node: HTMLElement, target: BattleEditorFocus) {
    handles.set(JSON.stringify(target), node);
    node.addEventListener("focus", () => emit({ type: "focused", target }), { signal: events.signal });
    node.addEventListener("blur", () => emit({ type: "blurred", target }), { signal: events.signal });
  }
  register(requiredElement<HTMLAnchorElement>(header, "a"), { kind: "normal" });
  for (const [node, kind] of [
    [preview, "preview"],
    [previewBack, "preview-back"],
    [save, "save"],
    [revert, "revert"],
    [exporter, "export"],
  ] as const) {
    register(node, { kind });
    node.addEventListener("click", () => emit({ type: kind }), { signal: events.signal });
  }
  for (const [node, team] of [
    [allyCount, "ally"],
    [enemyCount, "enemy"],
  ] as const) {
    register(node, { kind: team === "ally" ? "ally-count" : "enemy-count" });
    node.addEventListener("change", () => emit({ type: "count", team, count: Number(node.value) as 1 | 2 }), {
      signal: events.signal,
    });
  }
  for (const input of inputs) {
    const key = input.dataset.key as SettingKey;
    register(input, { kind: "field", key, control: input.type as "number" | "range" });
    input.addEventListener("input", () => emit({ type: "field", key, raw: input.value }), { signal: events.signal });
    input.addEventListener("change", finishGrounding, { signal: events.signal });
  }
  app.addEventListener(
    "keydown",
    (event) => {
      if (emit({ type: "key", key: event.key, shift: event.shiftKey })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal: events.signal },
  );
  let appliedFocus: BattleEditorFocus | null = null;
  return {
    render(frame: ReturnType<typeof projectBattleEditor>) {
      for (const input of inputs) {
        const key = input.dataset.key as SettingKey;
        const value =
          input.type === "range" && frame.invalid.includes(key) ? String(frame.current[key]) : frame.raw[key];
        if (input.value !== value) input.value = value;
        input.disabled = !frame.inputsEnabled;
        if (frame.invalid.includes(key)) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      }
      message.textContent = frame.message;
      message.classList.toggle("error", frame.error);
      save.disabled = !frame.canSave;
      revert.disabled = !frame.canRevert;
      exporter.disabled = !frame.canExport;
      allyCount.value = String(frame.counts.ally);
      enemyCount.value = String(frame.counts.enemy);
      document.body.classList.toggle("previewing", frame.preview);
      if (frame.focus !== appliedFocus) {
        appliedFocus = frame.focus;
        const node = frame.focus && handles.get(JSON.stringify(frame.focus));
        if (node && node !== document.activeElement) node.focus();
      }
    },
    dispose() {
      events.abort();
      header.remove();
      panel.remove();
      previewBack.remove();
      document.body.classList.remove("previewing");
    },
  };
}

export function mountBattleEditor(
  app: HTMLDivElement,
  battle: ReturnType<typeof createBattleScene>,
  initial: BattleSettings,
) {
  let state = createBattleEditorModel(initial);
  let groundingTimer: number | undefined;
  const events = new AbortController();
  const view = createBattleEditorView(app, dispatch, finishGrounding);
  function finishGrounding() {
    if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
    groundingTimer = undefined;
    const frame = projectBattleEditor(state);
    battle.applySettings(frame.current, frame.placements);
    battle.paintBattleFrame(frame.actors);
    dispatch({ type: "grounding", pending: false, measurements: battle.getGroundingMeasurements() });
  }
  function dispatch(event: BattleEditorEvent): boolean {
    const previous = state;
    const changed = reduceBattleEditor(state, event);
    state = changed.state;
    if (state !== previous) view.render(projectBattleEditor(state));
    for (const effect of changed.effects) {
      if (effect.type === "preview-settings") {
        const frame = projectBattleEditor(state);
        const pending = battle.previewSettings(effect.settings, frame.placements);
        battle.paintBattleFrame(frame.actors);
        if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
        groundingTimer = undefined;
        dispatch({ type: "grounding", pending, measurements: pending ? [] : battle.getGroundingMeasurements() });
        if (pending) groundingTimer = window.setTimeout(finishGrounding, 150);
      } else if (effect.type === "write-draft" || effect.type === "delete-draft") {
        try {
          if (effect.type === "write-draft") localStorage.setItem(draftStorageKey, JSON.stringify(effect.settings));
          else localStorage.removeItem(draftStorageKey);
        } catch {
          dispatch({ type: "storage-failed" });
        }
      } else if (effect.type === "save") {
        const body = JSON.stringify(effect.settings);
        void (async () => {
          try {
            const response = await fetch("/__dev/battle-settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              signal: events.signal,
            });
            const result = (await response.json()) as { message: string };
            dispatch({ type: response.ok ? "save-success" : "save-failed", message: result.message });
          } catch (error) {
            if (!events.signal.aborted)
              dispatch({
                type: "save-failed",
                message: error instanceof Error ? error.message : "保存できませんでした。",
              });
          }
        })();
      } else if (effect.type === "preview-counts") {
        finishGrounding();
      } else if (effect.type === "export") {
        const url = URL.createObjectURL(new Blob([effect.json], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "battle-settings.json";
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
    return changed.handled;
  }
  try {
    dispatch({ type: "draft-read", value: localStorage.getItem(draftStorageKey), available: true });
  } catch {
    dispatch({ type: "draft-read", value: null, available: false });
  }
  return () => {
    state = reduceBattleEditor(state, { type: "closed" }).state;
    events.abort();
    if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
    view.dispose();
  };
}
