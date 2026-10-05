import { createBattleEditorView } from "./battleEditorView.svelte.ts";

export { createBattleEditorView } from "./battleEditorView.svelte.ts";

import {
  type BattleEditorEvent,
  createBattleEditorModel,
  projectBattleEditor,
  reduceBattleEditor,
} from "../presentation/battleEditorModel";
import { type BattleSettings, draftStorageKey } from "../presentation/battleSettings";
import type { createBattleScene } from "./battleScene";

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
