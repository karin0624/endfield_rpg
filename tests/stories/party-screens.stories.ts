import type { Meta, StoryObj } from "@storybook/svelte-vite";
import Party from "../../src/web/components/Party.svelte";
import { partyFrame } from "./party-model";

const meta = {
  title: "Screens/Party",
  component: Party,
  args: { send: () => false },
  parameters: { design: { host: { padding: 0 } } },
} satisfies Meta<typeof Party>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Formation: Story = { args: { frame: partyFrame({ members: 2, edit: true }) } };
export const Departure: Story = { args: { frame: partyFrame({ members: 2, edit: false }) } };
export const Selection: Story = { args: { frame: partyFrame({ members: 2 }, "selection") } };
export const CharacterDetails: Story = { args: { frame: partyFrame({ members: 2 }, "details") } };
