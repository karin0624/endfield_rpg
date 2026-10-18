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
import { createDungeonModel } from "../src/presentation/dungeonModel";
/** The core constructs these representative snapshots without any native input or elapsed browser time. */
export function dungeonPicture() {
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
