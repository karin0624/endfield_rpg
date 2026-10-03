import {
  type AdventureSettingKey,
  type AdventureSettings,
  adventureDraftStorageKey,
  adventureSettingsFields,
  parseAdventureSettings,
} from "./adventureSettings";
import { requiredElement } from "./requiredElement";

type Preview = { applySettings(settings: AdventureSettings): void };

export function mountAdventureEditor(app: HTMLDivElement, preview: Preview, initial: AdventureSettings): () => void {
  let saved = { ...initial };
  let current = { ...initial };
  let initialMessage = "値を動かすと会話画面にすぐ反映されます。";
  try {
    const draft = localStorage.getItem(adventureDraftStorageKey);
    if (draft !== null) {
      current = parseAdventureSettings(JSON.parse(draft));
      initialMessage = "前回の未保存の調整を復元しました。";
    }
  } catch {
    current = { ...initial };
  }

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
  const previewOnly = requiredElement<HTMLButtonElement>(panel, "[data-preview-only]");
  let saving = false;

  function syncInputs(): void {
    for (const input of inputs) {
      input.value = String(current[input.dataset.key as AdventureSettingKey]);
      input.removeAttribute("aria-invalid");
    }
  }
  function setMessage(text: string, error = false): void {
    message.textContent = text;
    message.classList.toggle("error", error);
  }
  function storeDraft(): void {
    try {
      localStorage.setItem(adventureDraftStorageKey, JSON.stringify(current));
    } catch {
      setMessage("調整は反映されていますが、このブラウザへの一時保存はできません。");
    }
  }
  syncInputs();
  preview.applySettings(current);
  setMessage(initialMessage);

  panel.addEventListener(
    "input",
    (event) => {
      if (!(event.target instanceof HTMLInputElement) || saving) return;
      const key = event.target.dataset.key as AdventureSettingKey;
      try {
        current = parseAdventureSettings({ ...current, [key]: event.target.valueAsNumber });
        for (const input of inputs) {
          if (input.dataset.key === key && input !== event.target) input.value = String(current[key]);
          input.removeAttribute("aria-invalid");
        }
        preview.applySettings(current);
        storeDraft();
        save.disabled = false;
        setMessage("未保存の調整です。このブラウザに一時保存しています。");
      } catch (error) {
        event.target.setAttribute("aria-invalid", "true");
        save.disabled = true;
        setMessage(error instanceof Error ? error.message : "数値を確認してください。", true);
      }
    },
    { signal: events.signal },
  );
  revert.addEventListener(
    "click",
    () => {
      current = { ...saved };
      syncInputs();
      preview.applySettings(current);
      try {
        localStorage.removeItem(adventureDraftStorageKey);
      } catch {
        // The preview still reflects the saved settings.
      }
      save.disabled = false;
      setMessage("保存済みの標準に戻しました。");
    },
    { signal: events.signal },
  );
  save.addEventListener(
    "click",
    async () => {
      saving = true;
      save.disabled = true;
      setMessage("標準として保存しています…");
      try {
        const response = await fetch("/__dev/adventure-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(current),
          signal: events.signal,
        });
        const result = (await response.json()) as { message: string };
        if (!response.ok) throw new Error(result.message);
        saved = { ...current };
        try {
          localStorage.removeItem(adventureDraftStorageKey);
        } catch {
          // Saved JSON is the source of truth.
        }
        setMessage(result.message);
      } catch (error) {
        if (!events.signal.aborted) setMessage(error instanceof Error ? error.message : "保存できませんでした。", true);
      } finally {
        saving = false;
        save.disabled = false;
      }
    },
    { signal: events.signal },
  );
  previewOnly.addEventListener("click", () => document.body.classList.add("adventure-previewing"), {
    signal: events.signal,
  });
  back.addEventListener("click", () => document.body.classList.remove("adventure-previewing"), {
    signal: events.signal,
  });

  // ギルド初回は左右2人と選択肢を続けて確認できる。
  requiredElement<HTMLButtonElement>(app, '[data-place-id="guild"]').click();
  return () => {
    events.abort();
    document.body.classList.remove("adventure-previewing");
  };
}
