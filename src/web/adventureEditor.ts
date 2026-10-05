import { createAdventureEditorView } from "./adventureEditorView.svelte.ts";

export { createAdventureEditorView } from "./adventureEditorView.svelte.ts";

import {
  type AdventureEditorEvent,
  createAdventureEditorModel,
  projectAdventureEditor,
  reduceAdventureEditor,
} from "../presentation/adventureEditorModel";
import { type AdventureSettings, adventureDraftStorageKey } from "../presentation/adventureSettings";

type Preview = { applySettings(settings: AdventureSettings): void };
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
