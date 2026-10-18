import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import Campaign from "../../src/web/components/Campaign.svelte";
import { createUtilitySnapshot } from "../fixtures/utility";

const meta = {
  id: "utility-screens",
  title: "Screens/DS未対応/Utility",
  component: Campaign,
  args: { send: () => false },
  parameters: { design: { host: { padding: 0 } } },
} satisfies Meta<typeof Campaign>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Equipment: Story = { args: { frame: projectCampaign(createUtilitySnapshot("equipment", {})) } };
export const Preparation: Story = { args: { frame: projectCampaign(createUtilitySnapshot("preparation", {})) } };
export const Shop: Story = { args: { frame: projectCampaign(createUtilitySnapshot("shop", {})) } };
