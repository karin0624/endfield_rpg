import {
  type CampaignContext,
  type CampaignModel,
  campaignMachine,
  createCampaignModel,
} from "../../src/presentation/campaignModel";
import { projectCampaign } from "../../src/presentation/campaignProjection";
export function campaignState(name: string): CampaignModel {
  const initial = createCampaignModel();
  const context = initial.context;
  const commandFocus = (command: string) => ({ kind: "command" as const, command });
  const resolve = (value: CampaignModel["value"], patch: Partial<CampaignContext> = {}) =>
    campaignMachine.resolveState({ value, context: { ...context, ...patch } });
  switch (name) {
    case "title":
      return initial;
    case "title-loading":
      return resolve("loading");
    case "introduction":
      return resolve("intro");
    case "new-game-confirmation":
      return resolve("confirm", { confirmation: "new-game", focus: commandFocus("cancel") });
    case "home":
      return resolve("home");
    case "home-menu":
      return resolve("home", { hubPanel: "menu", focus: commandFocus("save") });
    case "home-title-options":
      return resolve("home", { hubPanel: "title-options", focus: commandFocus("close-panel") });
    case "home-save-confirmation":
      return resolve("confirm", { confirmation: "save", focus: commandFocus("cancel") });
    case "home-saving":
      return resolve("saving", { confirmation: "save" });
    case "destinations":
      return resolve("destinations");
    case "town":
      return resolve("town", { focus: { kind: "town-place", placeId: context.game.adventure.currentPlaceId } });
    case "town-menu":
      return resolve("town", { hubPanel: "menu", focus: commandFocus("title-options") });
    case "town-title-options":
      return resolve("town", { hubPanel: "title-options", focus: commandFocus("close-panel") });
    case "town-discard-confirmation":
      return resolve("confirm", { confirmation: "title", confirmOrigin: "town", focus: commandFocus("cancel") });
    default:
      throw new Error(`Unknown Campaign design screen: ${name}`);
  }
}

export const campaignFrame = (state: string) => projectCampaign(campaignState(state));
