import { mount, unmount } from "svelte";
import type { CampaignEvent } from "../presentation/campaignModel";
import type { CampaignFrame } from "../presentation/campaignProjection";
import Campaign from "./components/Campaign.svelte";
export function createCampaignView(root: HTMLDivElement, send: (event: CampaignEvent) => boolean) {
  let frame = $state.raw<CampaignFrame | null>(null);
  const component = mount(Campaign, {
    target: root,
    props: {
      root,
      send,
      get frame() {
        return frame;
      },
    },
  });
  return {
    render(next: CampaignFrame) {
      frame = next;
    },
    reportCarryValidity() {
      root.querySelector<HTMLInputElement>(".item-carry-input")?.reportValidity();
    },
    dispose() {
      void unmount(component);
    },
  };
}
