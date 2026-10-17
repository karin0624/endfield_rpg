import { tick } from "svelte";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import { createCampaignView } from "../../src/web/campaignView.svelte.ts";
import { isolateDesignComponent } from "./design-isolation";
import type { DesignCase } from "./design-view";
import { createUtilitySnapshot } from "./utility";

async function render(root: HTMLElement, props: Record<string, unknown>, kind: "equipment" | "preparation" | "shop") {
  if (!(root instanceof HTMLDivElement)) throw new Error("Utility design root must be a div");
  createCampaignView(root, () => false).render(projectCampaign(createUtilitySnapshot(kind, props)));
  await tick();
  if (typeof props.isolate === "string") isolateDesignComponent(root, props.isolate);
}

export const cases: Record<string, DesignCase> = {
  equipment: (root, props) => render(root, props, "equipment"),
  preparation: (root, props) => render(root, props, "preparation"),
  shop: (root, props) => render(root, props, "shop"),
};
