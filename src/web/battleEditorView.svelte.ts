import { mount, unmount } from "svelte";
import type { BattleEditorEvent, projectBattleEditor } from "../presentation/battleEditorModel";
import BattleEditor from "./components/BattleEditor.svelte";
import { requiredElement } from "./requiredElement";
export function createBattleEditorView(
  app: HTMLDivElement,
  emit: (event: BattleEditorEvent) => boolean,
  finish: () => void = () => {},
) {
  let frame = $state.raw<ReturnType<typeof projectBattleEditor> | null>(null);
  const main = requiredElement<HTMLElement>(app, "main");
  const components = (["header", "panel", "back"] as const).map((part) =>
    mount(BattleEditor, {
      target: part === "panel" ? main : app,
      ...(part === "header" ? { anchor: main } : {}),
      props: {
        app,
        part,
        emit,
        finish,
        get frame() {
          return frame;
        },
      },
    }),
  );
  return {
    render(next: ReturnType<typeof projectBattleEditor>) {
      frame = next;
    },
    dispose() {
      for (const component of components) void unmount(component);
    },
  };
}
