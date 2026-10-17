import { characters } from "../../src/content/characters";
import { recoveryItemId } from "../../src/content/itemSettings";
import { createParty } from "../../src/game/party";
import {
  type CampaignContext,
  campaignMachine,
  createCampaignModel,
  reduceCampaign,
} from "../../src/presentation/campaignModel";
export function createUtilitySnapshot(kind: "equipment" | "preparation" | "shop", props: Record<string, unknown>) {
  const initial = createCampaignModel();
  const game = initial.context.game;
  if (!game.inventory) throw new Error("Utility design fixtures require the real campaign inventory");
  const party = props.joined
    ? createParty(
        characters,
        characters.map((character) => character.id),
      )
    : game.party;
  const equipped = props.equipped === true;
  const inventory = {
    ...game.inventory,
    balance: typeof props.balance === "number" ? props.balance : game.inventory.balance,
    equipment: {
      ...game.inventory.equipment,
      owned: props.noEquipment ? [] : game.inventory.equipment.owned,
      assignments: equipped ? [{ characterId: "player", weapon: "weapon-1", armor: "armor-1" }] : [],
    },
    items: {
      ...game.inventory.items,
      home: [{ itemId: recoveryItemId, quantity: Number(props.stock ?? 3) }],
    },
  };
  const context: CampaignContext = {
    ...initial.context,
    game: { ...game, party, inventory },
    focus: null,
    hubPanel: kind === "preparation" ? "preparation" : "normal",
    carryQuantity: kind === "preparation" ? (props.quantity === null ? null : Number(props.quantity ?? 0)) : 0,
  };
  let snapshot = campaignMachine.resolveState({
    value: kind === "equipment" ? "equipment" : kind === "preparation" ? "home" : "town",
    context,
  });
  if (kind === "shop") {
    snapshot = reduceCampaign(snapshot, { type: "town", event: { type: "select", placeId: "market" } }).state;
    const current = snapshot.context;
    snapshot = campaignMachine.resolveState({
      value: "town",
      context: {
        ...current,
        town: {
          ...current.town,
          focus: null,
          shop: {
            open: props.open !== false,
            quantity: props.quantity === null ? null : Number(props.quantity ?? 1),
            message: String(props.message ?? ""),
            focus: null,
          },
        },
      },
    });
  }
  return snapshot;
}
