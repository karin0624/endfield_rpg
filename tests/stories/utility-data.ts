import { projectCampaign } from "../../src/presentation/campaignProjection";
import { createUtilitySnapshot } from "../fixtures/utility";

export function shopStoryFrame(props: Record<string, unknown> = {}) {
  const frame = projectCampaign(createUtilitySnapshot("shop", props));
  if (frame.kind !== "town") throw new Error("Shop story requires a town projection");
  return frame.town.shop;
}
export function equipmentStoryField() {
  const frame = projectCampaign(createUtilitySnapshot("equipment", {}));
  if (frame.kind !== "equipment") throw new Error("Equipment story requires equipment projection");
  return frame.members[0].slots[0];
}
