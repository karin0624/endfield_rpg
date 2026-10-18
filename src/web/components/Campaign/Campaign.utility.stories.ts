import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { createUtilitySnapshot } from "../../../../tests/fixtures/utility";
import { projectCampaign } from "../../../presentation/campaignProjection";
import Campaign from "./Campaign.svelte";

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
  args: { frame: projectCampaign(createUtilitySnapshot("equipment", {})) },
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
  args: { frame: projectCampaign(createUtilitySnapshot("preparation", {})) },
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
  args: { frame: projectCampaign(createUtilitySnapshot("shop", {})) },
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
