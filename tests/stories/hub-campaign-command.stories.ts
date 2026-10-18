import type { Meta, StoryObj } from "@storybook/svelte-vite";
import CampaignCommand from "../../src/web/components/CampaignCommand.svelte";

const meta = {
  title: "Legacy/CampaignCommand",
  component: CampaignCommand,
  parameters: { design: { host: { width: 512 } } },
  args: { label: "続きから", style: "width:512px" },
} satisfies Meta<typeof CampaignCommand>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "続きから" } };
export const Disabled: Story = { args: { label: "続きから", disabled: true } };
export const Primary: Story = { args: { label: "新規開始", primary: true } };
export const PrimaryDisabled: Story = { args: { label: "新規開始", primary: true, disabled: true } };
