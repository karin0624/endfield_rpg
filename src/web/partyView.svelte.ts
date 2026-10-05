import { mount, unmount } from "svelte";
import type { PartyEvent } from "../presentation/partyModel";
import type { PartyFrame } from "../presentation/partyProjection";
import Party from "./components/Party.svelte";

export function createPartyView(root: HTMLElement, send: (event: PartyEvent) => boolean) {
  let frame = $state.raw<PartyFrame | null>(null);
  const component = mount(Party, {
    target: root,
    props: {
      root,
      get frame() {
        return frame;
      },
      send,
    },
  });
  return {
    render(next: PartyFrame) {
      frame = next;
    },
    dispose() {
      void unmount(component);
    },
  };
}
