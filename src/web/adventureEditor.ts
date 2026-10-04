import {
  type AdventureEditorEvent,
  type AdventureEditorFocus,
  createAdventureEditorModel,
  projectAdventureEditor,
  reduceAdventureEditor,
} from "../presentation/adventureEditorModel";
import {
  type AdventureSettingKey,
  type AdventureSettings,
  adventureDraftStorageKey,
  adventureSettingsFields,
} from "../presentation/adventureSettings";
import { requiredElement } from "./requiredElement";

type Preview = { applySettings(settings: AdventureSettings): void };
export function createAdventureEditorView(app: HTMLDivElement, emit: (event: AdventureEditorEvent) => boolean) {
  const panel = document.createElement("aside");
  panel.className = "adventure-editor-panel";
  panel.setAttribute("aria-label", "会話画面の配置設定");
  panel.innerHTML = `
    <header>
      <p class="adventure-eyebrow">DEVELOPMENT / CONVERSATION</p>
      <h1>会話画面の配置</h1>
      <a href="${import.meta.env.BASE_URL}?debug=1">保存済みの通常表示</a>
    </header>
    <div class="adventure-editor-actions">
      <button type="button" data-preview-only>画面だけで確認</button>
      <button type="button" data-save>標準として保存</button>
      <button type="button" data-revert>保存済みに戻す</button>
      <p data-message role="status"></p>
      <p>画面をクリックして会話を送ると、別の話者や選択肢の配置も確認できます。</p>
    </div>
    <div class="adventure-editor-fields">
      ${[...new Set(adventureSettingsFields.map((field) => field.group))]
        .map(
          (group) =>
            `<fieldset><legend>${group}</legend>${adventureSettingsFields
              .filter((field) => field.group === group)
              .map(
                (field) => `<div class="setting-field">
                <label for="adventure-${field.key}">${field.label}</label>
                <input id="adventure-${field.key}" data-key="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" />
                <input aria-label="${field.label} スライダー" data-key="${field.key}" type="range" min="${field.min}" max="${field.max}" step="${field.step}" />
              </div>`,
              )
              .join("")}</fieldset>`,
        )
        .join("")}
    </div>`;
  const back = document.createElement("button");
  back.className = "adventure-preview-back";
  back.type = "button";
  back.textContent = "設定に戻る";
  app.append(panel, back);

  const events = new AbortController();
  const inputs = [...panel.querySelectorAll<HTMLInputElement>("input[data-key]")];
  const message = requiredElement<HTMLParagraphElement>(panel, "[data-message]");
  const save = requiredElement<HTMLButtonElement>(panel, "[data-save]");
  const revert = requiredElement<HTMLButtonElement>(panel, "[data-revert]");
  const preview = requiredElement<HTMLButtonElement>(panel, "[data-preview-only]");
  const handles = new Map<string, HTMLElement>();
  function register(node: HTMLElement, target: AdventureEditorFocus) {
    handles.set(JSON.stringify(target), node);
    node.addEventListener("focus", () => emit({ type: "focused", target }), { signal: events.signal });
    node.addEventListener("blur", () => emit({ type: "blurred", target }), { signal: events.signal });
  }
  register(requiredElement<HTMLAnchorElement>(panel, "a"), { kind: "normal" });
  for (const [node, kind] of [
    [preview, "preview"],
    [back, "preview-back"],
    [save, "save"],
    [revert, "revert"],
  ] as const) {
    register(node, { kind });
    node.addEventListener("click", () => emit({ type: kind }), { signal: events.signal });
  }
  for (const input of inputs) {
    const key = input.dataset.key as AdventureSettingKey;
    register(input, { kind: "field", key, control: input.type as "number" | "range" });
    input.addEventListener("input", () => emit({ type: "field", key, raw: input.value }), { signal: events.signal });
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
  let appliedFocus: AdventureEditorFocus | null = null;
  return {
    render(frame: ReturnType<typeof projectAdventureEditor>) {
      for (const input of inputs) {
        const key = input.dataset.key as AdventureSettingKey;
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
      document.body.classList.toggle("adventure-previewing", frame.preview);
      if (frame.focus !== appliedFocus) {
        appliedFocus = frame.focus;
        const node = frame.focus && handles.get(JSON.stringify(frame.focus));
        if (node && node !== document.activeElement) node.focus();
      }
    },
    dispose() {
      events.abort();
      panel.remove();
      back.remove();
      document.body.classList.remove("adventure-previewing");
    },
  };
}

export function mountAdventureEditor(app: HTMLDivElement, preview: Preview, initial: AdventureSettings): () => void {
  let state = createAdventureEditorModel(initial);
  const events = new AbortController();
  const view = createAdventureEditorView(app, dispatch);
  function dispatch(event: AdventureEditorEvent): boolean {
    const previous = state;
    const changed = reduceAdventureEditor(state, event);
    state = changed.state;
    if (state !== previous) view.render(projectAdventureEditor(state));
    for (const effect of changed.effects) {
      if (effect.type === "preview-settings") preview.applySettings(effect.settings);
      else if (effect.type === "write-draft" || effect.type === "delete-draft") {
        try {
          if (effect.type === "write-draft")
            localStorage.setItem(adventureDraftStorageKey, JSON.stringify(effect.settings));
          else localStorage.removeItem(adventureDraftStorageKey);
          dispatch({ type: "storage-result", available: true });
        } catch {
          dispatch({ type: "storage-result", available: false });
        }
      } else if (effect.type === "save") {
        const body = JSON.stringify(effect.settings);
        void (async () => {
          try {
            const response = await fetch("/__dev/adventure-settings", {
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
      }
    }
    return changed.handled;
  }
  try {
    dispatch({ type: "draft-read", value: localStorage.getItem(adventureDraftStorageKey), available: true });
  } catch {
    dispatch({ type: "draft-read", value: null, available: false });
  }
  return () => {
    state = reduceAdventureEditor(state, { type: "closed" }).state;
    events.abort();
    view.dispose();
  };
}
