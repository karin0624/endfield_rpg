import { flushSync, mount, unmount } from "svelte";
import type { AdventureEvent } from "../presentation/adventureModel";
import type { AdventureFrame } from "../presentation/adventureProjection";
import type { AdventureSettings } from "../presentation/adventureSettings";
import Adventure from "./components/Adventure.svelte";
import { requiredElement } from "./requiredElement";
export function createAdventureView(
  root: HTMLDivElement,
  utilities: AdventureFrame["utilities"],
  send: (event: AdventureEvent) => boolean,
  initialSettings: AdventureSettings,
) {
  let frame = $state.raw<AdventureFrame | null>(null);
  let settings = $state.raw(initialSettings);
  const component = mount(Adventure, {
    target: root,
    props: {
      root,
      utilities,
      send,
      get frame() {
        return frame;
      },
      get settings() {
        return settings;
      },
    },
  });
  flushSync();
  return {
    conversationHost: requiredElement<HTMLElement>(root, "[data-conversation-view]"),
    render(next: AdventureFrame) {
      frame = next;
    },
    applySettings(next: AdventureSettings) {
      settings = next;
    },
    dispose() {
      void unmount(component);
    },
  };
}
