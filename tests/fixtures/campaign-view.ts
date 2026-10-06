import { type CampaignModel, campaignMachine, createCampaignModel } from "../../src/presentation/campaignModel";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import { createCampaignView } from "../../src/web/campaignView.svelte.ts";
import "../../src/web/style.css";
import { returnedCampaign as returned } from "./returned-campaign";

const initial = createCampaignModel();
const returnedGame = returned.game;
const snapshots: Readonly<Record<string, CampaignModel>> = {
  confirmation: campaignMachine.resolveState({
    value: "confirm",
    context: {
      ...initial.context,
      confirmation: "new-game",
      focus: { kind: "command", command: "cancel" },
    },
  }),
  introduction: campaignMachine.resolveState({
    value: "intro",
    context: initial.context,
  }),
  home: campaignMachine.resolveState({
    value: "home",
    context: initial.context,
  }),
  destinations: campaignMachine.resolveState({
    value: "destinations",
    context: initial.context,
  }),
  town: campaignMachine.resolveState({
    value: "town",
    context: {
      ...initial.context,
      town: { ...initial.context.town, focus: null },
      focus: null,
    },
  }),
  returned: campaignMachine.resolveState({
    value: "home",
    context: {
      ...initial.context,
      game: returnedGame,
      completion: returned.completion,
    },
  }),
  save: campaignMachine.resolveState({
    value: "confirm",
    context: {
      ...initial.context,
      game: returnedGame,
      confirmation: "save-title",
      focus: { kind: "command", command: "cancel" },
    },
  }),
  saved: campaignMachine.resolveState({
    value: initial.value,
    context: {
      ...initial.context,
      game: returnedGame,
      message: "保存しました。",
    },
  }),
  resumed: campaignMachine.resolveState({
    value: "home",
    context: {
      ...initial.context,
      game: returnedGame,
      message: "読み込みました。",
    },
  }),
};
const key = new URLSearchParams(location.search).get("state") ?? "home";
const snapshot = snapshots[key];
if (!snapshot) throw new Error(`Unknown campaign picture: ${key}`);
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing picture root");
// Browser actions prepare only native hover/pressed/focus modality; this picture never advances a game.
createCampaignView(root, () => false).render(projectCampaign(snapshot));
