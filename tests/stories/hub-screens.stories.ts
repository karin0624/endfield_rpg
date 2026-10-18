import type { Meta, StoryObj } from "@storybook/svelte-vite";
import Campaign from "../../src/web/components/Campaign.svelte";
import { campaignFrame } from "./hub-model";

const meta = {
  title: "Screens/Campaign",
  component: Campaign,
  args: { send: () => false },
  parameters: { design: { host: { padding: 0 } } },
} satisfies Meta<typeof Campaign>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Town: Story = { args: { frame: campaignFrame("town") } };
export const Destinations: Story = { args: { frame: campaignFrame("destinations") } };
export const HomeMenu: Story = { args: { frame: campaignFrame("home-menu") } };
export const HomeTitleOptions: Story = { args: { frame: campaignFrame("home-title-options") } };
export const HomeSaveConfirmation: Story = { args: { frame: campaignFrame("home-save-confirmation") } };
export const HomeSaving: Story = { args: { frame: campaignFrame("home-saving") } };
export const TownMenu: Story = { args: { frame: campaignFrame("town-menu") } };
export const TownTitleOptions: Story = { args: { frame: campaignFrame("town-title-options") } };
export const TownDiscardConfirmation: Story = { args: { frame: campaignFrame("town-discard-confirmation") } };
export const Home: Story = { args: { frame: campaignFrame("home") } };
export const Title: Story = { args: { frame: campaignFrame("title") } };
export const TitleLoading: Story = { args: { frame: campaignFrame("title-loading") } };
export const Introduction: Story = { args: { frame: campaignFrame("introduction") } };
export const NewGameConfirmation: Story = { args: { frame: campaignFrame("new-game-confirmation") } };
