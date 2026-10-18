import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubDialog from "../../src/web/components/HubDialog.svelte";

const meta = {
  title: "Hub/Dialog",
  component: HubDialog,
  args: { panel: "menu", command: () => {} },
  parameters: { design: { host: { className: "hub-theme", width: "max-content" } } },
} satisfies Meta<typeof HubDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MenuHome: Story = { args: { panel: "menu", scene: "home" } };
export const MenuTown: Story = { args: { panel: "menu", scene: "town" } };
export const TitleHome: Story = { args: { panel: "title-options", scene: "home" } };
export const TitleTown: Story = { args: { panel: "title-options", scene: "town" } };
export const SaveConfirmation: Story = { args: { panel: null, confirmation: "save" } };
