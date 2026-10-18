import type { Meta, StoryObj } from "@storybook/svelte-vite";
import IllustratedAction from "../../src/web/components/IllustratedAction.svelte";

const meta = {
  title: "Hub/IllustratedAction",
  component: IllustratedAction,
  args: { id: "design-action", picture: "companions", label: "仲間", onclick: () => {} },
  parameters: { design: { host: { className: "hub-theme", width: "max-content" } } },
} satisfies Meta<typeof IllustratedAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Companions: Story = { args: { movement: false, picture: "companions", label: "仲間" } };
export const Travel: Story = { args: { movement: true, picture: "map-icon", label: "出かける" } };
export const Place: Story = { args: { round: true, picture: "tavern", label: "酒場" } };
