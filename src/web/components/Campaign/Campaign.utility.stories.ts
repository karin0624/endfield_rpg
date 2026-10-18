import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { recoveryItemId } from "../../../content/itemSettings";
import { campaignMachine, createCampaignModel } from "../../../presentation/campaignModel";
import { projectCampaign } from "../../../presentation/campaignProjection";
import Campaign from "./Campaign.svelte";

const initial = createCampaignModel().context;
const inventory = initial.game.inventory;
if (!inventory) throw new Error("The utility screens require an inventory");
const context = {
  ...initial,
  focus: null,
  game: {
    ...initial.game,
    inventory: {
      ...inventory,
      equipment: { ...inventory.equipment, assignments: [] },
      items: { ...inventory.items, home: [{ itemId: recoveryItemId, quantity: 3 }] },
    },
  },
};

const meta = {
  id: "utility-screens",
  title: "Screens/DS未対応/Utility",
  component: Campaign,
  args: { send: () => false },
  parameters: { design: { host: { padding: 0 }, kind: "screen", viewport: { width: 1920, height: 1080 } } },
} satisfies Meta<typeof Campaign>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Equipment: Story = {
  args: { frame: projectCampaign(campaignMachine.resolveState({ value: "equipment", context })) },
  parameters: {
    design: {
      targets: [
        {
          id: "utility/screen/equipment",
          state: "utility/screen/equipment",
          figma: { path: ["Screens / DS未対応", "Equipment / default — DS未対応"] },
        },
      ],
    },
  },
};
export const Preparation: Story = {
  args: {
    frame: projectCampaign(
      campaignMachine.resolveState({
        value: "home",
        context: { ...context, hubPanel: "preparation", carryQuantity: 0 },
      }),
    ),
  },
  parameters: {
    design: {
      targets: [
        {
          id: "utility/screen/preparation",
          state: "utility/screen/preparation",
          figma: { path: ["Screens / DS未対応", "Preparation / default — DS未対応"] },
        },
      ],
    },
  },
};
export const Shop: Story = {
  args: {
    frame: projectCampaign(
      campaignMachine.resolveState({
        value: "town",
        context: {
          ...context,
          game: {
            ...context.game,
            clock: { elapsedHalfDays: 0, recoverySteps: 0, pendingAction: { kind: "town-exploration" } },
            adventure: {
              ...context.game.adventure,
              mode: "conversation",
              currentPlaceId: "market",
              conversationId: "market",
              conversationPosition: "market-greeting",
            },
          },
          town: {
            ...context.town,
            focus: null,
            shop: { open: true, quantity: 1, message: "", focus: null },
          },
        },
      }),
    ),
  },
  parameters: {
    design: {
      targets: [
        {
          id: "utility/screen/shop",
          state: "utility/screen/shop",
          figma: {
            path: ["Screens / DS未対応", "Item Shop / default — DS未対応"],
            interactions: [
              {
                type: "click",
                node: { path: ["Screens / DS未対応", "Item Shop / default — DS未対応", "shop-trigger"] },
              },
            ],
          },
        },
      ],
    },
  },
};
