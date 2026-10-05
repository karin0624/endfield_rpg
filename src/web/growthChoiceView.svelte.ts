import { mount, unmount } from "svelte";
import type { GrowthEvent, GrowthFocus } from "../presentation/growthModel";
import type { GrowthFrame } from "../presentation/growthProjection";
import GrowthChoice from "./components/GrowthChoice.svelte";

export function createGrowthChoiceView(root: HTMLElement, send: (event: GrowthEvent) => boolean) {
  let frame = $state.raw<GrowthFrame>();
  let focus = $state.raw<GrowthFocus>(null);
  let component: ReturnType<typeof mount> | undefined;
  return {
    render(next: GrowthFrame, target: GrowthFocus) {
      frame = next;
      focus = target;
      component ??= mount(GrowthChoice, {
        target: root,
        props: {
          get frame() {
            if (!frame) throw new Error("A rendered frame is required");
            return frame;
          },
          get focus() {
            return focus;
          },
          send,
        },
      });
    },
    dispose() {
      if (component) void unmount(component);
    },
  };
}
