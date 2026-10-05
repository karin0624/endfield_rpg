import { mount, unmount } from "svelte";
import type { projectTownShop, TownEvent } from "../presentation/townModel";
import ItemShop from "./components/ItemShop.svelte";

export function createItemShopView(host: HTMLElement, send: (event: TownEvent) => boolean) {
  let frame = $state.raw<ReturnType<typeof projectTownShop>>();
  let component: ReturnType<typeof mount> | undefined;
  return {
    render(next: ReturnType<typeof projectTownShop>) {
      frame = next;
      component ??= mount(ItemShop, {
        target: host,
        props: {
          get frame() {
            if (!frame) throw new Error("A rendered frame is required");
            return frame;
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
