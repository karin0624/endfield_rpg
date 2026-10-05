import { mount, unmount } from "svelte";
import type { AdventureEditorEvent, projectAdventureEditor } from "../presentation/adventureEditorModel";
import AdventureEditor from "./components/AdventureEditor.svelte";
export function createAdventureEditorView(app: HTMLDivElement, emit: (event: AdventureEditorEvent) => boolean) {
  let frame = $state.raw<ReturnType<typeof projectAdventureEditor> | null>(null);
  const component = mount(AdventureEditor, {
    target: app,
    props: {
      app,
      emit,
      get frame() {
        return frame;
      },
    },
  });
  return {
    render(next: ReturnType<typeof projectAdventureEditor>) {
      frame = next;
    },
    dispose() {
      void unmount(component);
    },
  };
}
