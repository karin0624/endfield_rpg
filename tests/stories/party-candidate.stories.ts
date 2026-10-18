import type { Meta, StoryObj } from "@storybook/svelte-vite";
import PartyCandidate from "../../src/web/components/PartyCandidate.svelte";
import { partyCandidateMember } from "./party-model";

const meta = {
  title: "Party/Candidate",
  component: PartyCandidate,
  args: { member: partyCandidateMember(), send: () => false },
  parameters: { design: { host: { className: "ui-screen formation-theme", width: "max-content" } } },
} satisfies Meta<typeof PartyCandidate>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = { args: { member: partyCandidateMember() } };
export const Unselected: Story = {
  args: { member: partyCandidateMember({ selected: false }) },
};
export const Symptoms: Story = {
  args: { member: partyCandidateMember({ symptoms: true }) },
};
export const PortraitFailed: Story = {
  args: { member: partyCandidateMember({ failedPortrait: true }) },
};
