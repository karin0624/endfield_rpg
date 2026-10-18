import { campaignMachine, createCampaignModel } from "../../src/presentation/campaignModel";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import { createCampaignView } from "../../src/web/campaignView.svelte.ts";
import "../../src/web/style.css";

const initial = createCampaignModel();
const state = new URLSearchParams(location.search).get("state") ?? "home";
if (state !== "home" && state !== "destinations" && state !== "town")
  throw new Error(`Unknown campaign layout state: ${state}`);
const snapshot = campaignMachine.resolveState({
  value: state,
  context:
    state === "town"
      ? { ...initial.context, town: { ...initial.context.town, focus: null }, focus: null }
      : initial.context,
});
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing picture root");
// The retained responsive layout and focus checks never advance a game.
createCampaignView(root, () => false).render(projectCampaign(snapshot));
