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
        ${group === "味方の配置" || group === "敵の配置" ? '<p class="field-help">中心を固定し、人数に応じて隣への差分で均等に並べます。高さは地面から自動取得します。</p>' : ""}
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
  const allyCount = panel.querySelector<HTMLSelectElement>("[data-preview-ally-count]")!;
  const enemyCount = panel.querySelector<HTMLSelectElement>("[data-preview-enemy-count]")!;
  let saving = false;
  let groundingTimer: number | undefined;
  const setMessage = (text: string, error = false) => {
    message.textContent = text;
    message.classList.toggle("error", error);
  };
  const placementMessage = () => battle.getPlacementWarnings().join(" ");
  const setPlacementAwareMessage = (normal: string) => {
    const warning = placementMessage();
    if (warning) {
      setMessage(`保存できません: ${warning}`, true);
      save.disabled = true;
      return;
    }
    setMessage(normal);
    save.disabled = false;
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
  const unsavedMessage = () => storageAvailable
    ? "未保存の調整です。このブラウザに一時保存しています。"
    : "未保存の調整です。一時保存が使えないため、閉じる前に標準として保存してください。";
  const finishGrounding = () => {
    if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
    groundingTimer = undefined;
    battle.applySettings(current);
    setPlacementAwareMessage(unsavedMessage());
  };
  const scheduleGrounding = () => {
    if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
    groundingTimer = window.setTimeout(finishGrounding, 150);
  };
  syncInputs();
  battle.applySettings(current);
  setPlacementAwareMessage(initialMessage);

  const updatePreviewCounts = () => {
    battle.setPreviewCounts({
      ally: Number(allyCount.value),
      enemy: Number(enemyCount.value),
    });
  };
  allyCount.addEventListener("change", updatePreviewCounts, { signal: events.signal });
  enemyCount.addEventListener("change", updatePreviewCounts, { signal: events.signal });

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
      const groundingRequired = battle.previewSettings(current);
      storeDraft();
      exporter.disabled = false;
      if (groundingRequired) {
        save.disabled = true;
        setMessage("配置を反映しました。接地を確認しています…");
        scheduleGrounding();
      } else {
        setPlacementAwareMessage(unsavedMessage());
      }
    } catch (error) {
      if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
      groundingTimer = undefined;
      event.target.setAttribute("aria-invalid", "true");
      save.disabled = true;
      exporter.disabled = true;
      setMessage(error instanceof Error ? error.message : "数値を確認してください。", true);
    }
  }, { signal: events.signal });

  panel.addEventListener("change", event => {
    if (!(event.target instanceof HTMLInputElement) || saving || event.target.getAttribute("aria-invalid") === "true") return;
    if (groundingTimer !== undefined) finishGrounding();
  }, { signal: events.signal });

  revert.addEventListener("click", () => {
    if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
    groundingTimer = undefined;
    current = { ...saved };
    syncInputs();
    battle.applySettings(current);
    try { localStorage.removeItem(draftStorageKey); } catch { storageAvailable = false; }
    exporter.disabled = false;
    setPlacementAwareMessage("保存済みの標準に戻しました。");
  }, { signal: events.signal });

  save.addEventListener("click", async () => {
    if (groundingTimer !== undefined) finishGrounding();
    if (placementMessage()) {
      setPlacementAwareMessage("配置を調整してから保存してください。");
      return;
    }
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
    if (groundingTimer !== undefined) window.clearTimeout(groundingTimer);
    events.abort();
    header.remove();
    panel.remove();
    previewBack.remove();
    document.body.classList.remove("previewing");
  };
}
