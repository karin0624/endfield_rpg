import { type CampaignModel, createCampaignModel } from "../../src/presentation/campaignModel";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import { createCampaignView } from "../../src/web/campaignView";
import "../../src/web/style.css";
import { returnedCampaign as returned } from "./returned-campaign";

const initial = createCampaignModel();
const returnedGame = returned.game;
const snapshots: Readonly<Record<string, CampaignModel>> = {
  confirmation: {
    ...initial,
    screen: { kind: "confirm", action: "new-game" },
    focus: { kind: "command", command: "cancel" },
  },
  introduction: { ...initial, screen: { kind: "intro" } },
  home: { ...initial, screen: { kind: "home" } },
  destinations: { ...initial, screen: { kind: "destinations" } },
  town: { ...initial, screen: { kind: "town" }, town: { ...initial.town, focus: null }, focus: null },
  returned: {
    ...initial,
    game: returnedGame,
    screen: { kind: "home" },
    completion: returned.completion,
  },
  save: {
    ...initial,
    game: returnedGame,
    screen: { kind: "confirm", action: "save-title" },
    focus: { kind: "command", command: "cancel" },
  },
  saved: { ...initial, game: returnedGame, message: "保存しました。" },
  resumed: { ...initial, game: returnedGame, screen: { kind: "home" }, message: "読み込みました。" },
};
const key = new URLSearchParams(location.search).get("state") ?? "home";
const snapshot = snapshots[key];
if (!snapshot) throw new Error(`Unknown campaign picture: ${key}`);
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing picture root");
// Browser actions prepare only native hover/pressed/focus modality; this picture never advances a game.
createCampaignView(root, () => false).render(projectCampaign(snapshot));
