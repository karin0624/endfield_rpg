import type { Meta, StoryObj } from "@storybook/svelte-vite";
import PartyDetailAction from "../../src/web/components/PartyDetailAction.svelte";

const meta = {
  title: "Party/DetailAction",
  component: PartyDetailAction,
  args: { name: "ロッシ", characterId: "player" },
  parameters: { design: { host: { className: "ui-screen formation-theme", width: "max-content" } } },
} satisfies Meta<typeof PartyDetailAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
