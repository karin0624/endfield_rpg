import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubAction from "../../src/web/components/HubAction.svelte";

const meta = {
  title: "Hub/Action",
  component: HubAction,
  parameters: { design: { host: { className: "hub-theme", width: "max-content" } } },
} satisfies Meta<typeof HubAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Menu: Story = { args: { icon: "menu" } };
export const Close: Story = { args: { icon: "close", "aria-label": "閉じる" } };
export const Default: Story = { args: { label: "取り消す", style: "width:212px" } };
export const Disabled: Story = { args: { label: "取り消す", style: "width:212px", disabled: true } };
export const Primary: Story = { args: { label: "保存", primary: true, style: "width:212px" } };
export const PrimaryDisabled: Story = { args: { label: "保存", primary: true, style: "width:212px", disabled: true } };
