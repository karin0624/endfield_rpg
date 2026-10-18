import type { Meta, StoryObj } from "@storybook/svelte-vite";
import PartyFooterAction from "../../src/web/components/PartyFooterAction.svelte";

const meta = {
  title: "Party/FooterAction",
  component: PartyFooterAction,
  args: { action: "back" },
  parameters: { design: { host: { className: "ui-screen formation-theme", width: "max-content" } } },
} satisfies Meta<typeof PartyFooterAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Back: Story = { args: { action: "back", "data-party-back": true } };
export const Depart: Story = { args: { action: "depart", "data-depart": true } };
export const DepartDisabled: Story = { args: { action: "depart", "data-depart": true, disabled: true } };
export const Confirm: Story = { args: { action: "confirm", "data-confirm": true } };
