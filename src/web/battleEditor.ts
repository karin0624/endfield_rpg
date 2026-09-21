import type { createBattleScene } from "./battleScene";
import { draftStorageKey, parseBattleSettings, settingsFields, type BattleSettings, type SettingKey } from "./battleSettings";

export function mountBattleEditor(
  app: HTMLDivElement,
  battle: ReturnType<typeof createBattleScene>,
  initial: BattleSettings,
) {
  let saved = { ...initial };
  let current = { ...initial };
  let storageAvailable = true;
  let initialMessage = "調整はプレビューに即時反映されます。標準として保存すると通常表示にも反映されます。";
  try {
    const draft = localStorage.getItem(draftStorageKey);
    if (draft) {
      try {
        current = parseBattleSettings(JSON.parse(draft));
        initialMessage = "前回の未保存の調整を復元しました。";
      } catch {
        localStorage.removeItem(draftStorageKey);
        initialMessage = "前回の調整を読み取れなかったため、保存済みの標準を表示しています。";
      }
    }
  } catch { storageAvailable = false; }

  const groups = [...new Set(settingsFields.map(field => field.group))];
  const header = document.createElement("header");
  header.className = "editor-header";
  header.innerHTML = `<div><p class="eyebrow">DEVELOPMENT / COMPOSITION</p><h1>戦闘画面の構図</h1></div>
    <div class="header-actions"><a href="${import.meta.env.BASE_URL}">保存済みの通常表示</a><button type="button" data-preview>画面だけで確認</button></div>`;
  const panel = document.createElement("aside");
  panel.className = "editor-panel";
  panel.setAttribute("aria-label", "構図設定");
  panel.innerHTML = `
    <div class="save-panel">
      <button type="button" class="primary" data-save>標準として保存</button>
      <p class="editor-message" role="status" data-message></p>
      <div class="secondary-actions"><button type="button" data-revert>保存済みに戻す</button><button type="button" data-export>JSONを書き出す</button></div>
    </div>
    <div class="settings-fields">${groups.map(group => `
      <fieldset><legend>${group}</legend>
        ${settingsFields.filter(field => field.group === group).map(field => `
          <div class="setting-field">
            <label for="${field.key}-number">${field.label}</label>
            <input id="${field.key}-number" data-key="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" />
            <input aria-label="${field.label} スライダー" data-key="${field.key}" type="range" min="${field.min}" max="${field.max}" step="${field.step}" />
          </div>`).join("")}
        ${group === "地面" ? '<p class="field-help">立ち位置は地面上の同じ地点に追従します。立ち絵の大きさは変わりません。</p>' : ""}
        ${group === "遠景" ? '<p class="field-help">高さ・前後で地面との重なりを調整します。縦横比は固定です。前後は小さい値ほど奥へ動きます。</p>' : ""}
      </fieldset>`).join("")}</div>`;
  const previewBack = document.createElement("button");
  previewBack.type = "button";
  previewBack.className = "preview-back";
  previewBack.textContent = "設定に戻る";
  app.prepend(header);
  app.querySelector("main")!.append(panel);
  app.append(previewBack);

  const events = new AbortController();
  const inputs = [...panel.querySelectorAll<HTMLInputElement>("input")];
  const message = panel.querySelector<HTMLParagraphElement>("[data-message]")!;
  const save = panel.querySelector<HTMLButtonElement>("[data-save]")!;
  const revert = panel.querySelector<HTMLButtonElement>("[data-revert]")!;
  const exporter = panel.querySelector<HTMLButtonElement>("[data-export]")!;
  let saving = false;
  const setMessage = (text: string, error = false) => {
    message.textContent = text;
    message.classList.toggle("error", error);
  };
  const syncInputs = (key?: SettingKey, active?: HTMLInputElement) => {
    for (const input of inputs) {
      const name = input.dataset.key as SettingKey;
      if ((!key || key === name) && input !== active) input.value = String(current[name]);
      input.removeAttribute("aria-invalid");
    }
  };
  const storeDraft = () => {
    try { localStorage.setItem(draftStorageKey, JSON.stringify(current)); }
    catch { storageAvailable = false; }
  };
  syncInputs();
  battle.applySettings(current);
  setMessage(initialMessage);

  panel.addEventListener("input", event => {
    if (!(event.target instanceof HTMLInputElement) || saving) return;
    const key = event.target.dataset.key as SettingKey;
    const candidate = { ...current };
    for (const input of inputs.filter(input => input.type === "number")) {
      candidate[input.dataset.key as SettingKey] = input.valueAsNumber;
    }
    candidate[key] = event.target.valueAsNumber;
    try {
      current = parseBattleSettings(candidate);
      syncInputs(key, event.target);
      battle.applySettings(current);
      storeDraft();
      save.disabled = false;
      exporter.disabled = false;
      setMessage(storageAvailable
        ? "未保存の調整です。このブラウザに一時保存しています。"
        : "未保存の調整です。一時保存が使えないため、閉じる前に標準として保存してください。");
    } catch (error) {
      event.target.setAttribute("aria-invalid", "true");
      save.disabled = true;
      exporter.disabled = true;
      setMessage(error instanceof Error ? error.message : "数値を確認してください。", true);
    }
  }, { signal: events.signal });

  revert.addEventListener("click", () => {
    current = { ...saved };
    syncInputs();
    battle.applySettings(current);
    try { localStorage.removeItem(draftStorageKey); } catch { storageAvailable = false; }
    save.disabled = false;
    exporter.disabled = false;
    setMessage("保存済みの標準に戻しました。");
  }, { signal: events.signal });

  save.addEventListener("click", async () => {
    saving = true;
    save.disabled = true;
    revert.disabled = true;
    inputs.forEach(input => { input.disabled = true; });
    setMessage("標準として保存しています…");
    try {
      const response = await fetch("/__dev/battle-settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current), signal: events.signal,
      });
      const result = await response.json() as { message: string };
      if (!response.ok) throw new Error(result.message);
      saved = { ...current };
      try { localStorage.removeItem(draftStorageKey); } catch { storageAvailable = false; }
      setMessage(result.message);
    } catch (error) {
      if (!events.signal.aborted) setMessage(error instanceof Error ? error.message : "保存できませんでした。", true);
    } finally {
      saving = false;
      save.disabled = false;
      revert.disabled = false;
      inputs.forEach(input => { input.disabled = false; });
    }
  }, { signal: events.signal });

  exporter.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2) + "\n"], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "battle-settings.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, { signal: events.signal });
  header.querySelector("[data-preview]")!.addEventListener("click", () => {
    document.body.classList.add("previewing");
    previewBack.focus();
  }, { signal: events.signal });
  previewBack.addEventListener("click", () => {
    document.body.classList.remove("previewing");
    header.querySelector<HTMLButtonElement>("[data-preview]")!.focus();
  }, { signal: events.signal });

  return () => {
    events.abort();
    header.remove();
    panel.remove();
    previewBack.remove();
    document.body.classList.remove("previewing");
  };
}
