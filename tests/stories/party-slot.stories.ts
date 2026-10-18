import type { Meta, StoryObj } from "@storybook/svelte-vite";
import PartySlot from "../../src/web/components/PartySlot.svelte";
import { partySlotMember } from "./party-model";

const meta = {
  title: "Party/Slot",
  component: PartySlot,
  args: { slot: 0, member: partySlotMember(), send: () => false },
  parameters: { design: { host: { className: "ui-screen formation-theme", width: 372.046875 } } },
} satisfies Meta<typeof PartySlot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Occupied: Story = { args: { member: partySlotMember() } };
export const PortraitFailed: Story = {
  args: { member: partySlotMember({ failedPortrait: "player" }) },
};
export const Empty: Story = { args: { slot: 2, member: null } };
