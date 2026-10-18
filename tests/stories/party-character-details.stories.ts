import type { Meta, StoryObj } from "@storybook/svelte-vite";
import CharacterDetailsPanel from "../../src/web/components/CharacterDetailsPanel.svelte";
import { partyFrame } from "./party-model";

const meta = {
  title: "Party/CharacterDetailsPanel",
  component: CharacterDetailsPanel,
  args: { model: partyFrame({ members: 2 }, "details").details, send: () => false },
  parameters: { design: { host: { className: "ui-screen formation-theme", width: "max-content" } } },
} satisfies Meta<typeof CharacterDetailsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { model: partyFrame({ members: 2 }, "details").details } };
export const Symptoms: Story = { args: { model: partyFrame({ members: 2, symptoms: true }, "details").details } };
export const PortraitFailed: Story = {
  args: { model: partyFrame({ members: 2, failedPortrait: true }, "details").details },
};
export const Unavailable: Story = { args: { model: partyFrame({ members: 2, disabled: true }, "details").details } };
export const EmptySkills: Story = { args: { model: partyFrame({ members: 2, skills: "empty" }, "details").details } };
