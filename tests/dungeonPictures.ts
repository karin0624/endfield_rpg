import { characters } from "../src/content/characters";
import { initialAdventure } from "../src/content/initialAdventure";
import { initialDungeon } from "../src/content/initialDungeon";
import { itemCatalog, recoveryItemId } from "../src/content/itemSettings";
import { departOnExpedition } from "../src/game/expedition";
import { createInventory } from "../src/game/inventory";
import { createItemState } from "../src/game/items";
import {
  campaignDungeonInput,
  campaignMachine,
  campaignRules,
  createCampaignModel,
} from "../src/presentation/campaignModel";
import { createDebugSessionModel, debugDungeonInput, reduceDebugSession } from "../src/presentation/debugSessionModel";
import { createDungeonModel } from "../src/presentation/dungeonModel";
/** The core constructs these representative snapshots without any native input or elapsed browser time. */
export function dungeonPicture(name: "initial" | "progressed" | "items") {
  if (name === "items") {
    const app = createCampaignModel();
    const carried = [{ itemId: recoveryItemId, quantity: 2 }];
    const departed = departOnExpedition(
      {
        ...app.context.game,
        inventory: { ...createInventory(), items: createItemState(carried, itemCatalog) },
      },
      characters,
      initialDungeon,
      initialAdventure,
      campaignRules,
      carried,
    );
    if (!departed.accepted) throw new Error(departed.reason);
    const input = campaignDungeonInput(
      campaignMachine.resolveState({
        value: app.value,
        context: {
          ...app.context,
          game: departed.state,
        },
      }),
    );
    return { state: createDungeonModel(input), input };
  }
  let app = createDebugSessionModel("dungeon");
  if (name === "progressed") {
    for (const event of [
      { type: "enter", nodeId: "conversation-b" },
      { type: "advance" },
      { type: "choose", optionId: "mark-on-map" },
      { type: "growth", event: { type: "choose", skillId: "test-vitality" } },
    ] as const) {
      const changed = reduceDebugSession(app, { type: "dungeon", event });
      if (!changed.handled) throw new Error(`Unavailable picture input: ${event.type}`);
      app = changed.state;
    }
  }
  if (!app.expedition) throw new Error("Missing expedition picture");
  return { state: app.expedition, input: debugDungeonInput(app) };
}
