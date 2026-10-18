import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { partySlotMember } from "../../../../.storybook/fixtures/party-model";
import PartySlot from "./PartySlot.svelte";

const meta = {
  title: "Party/Slot",
  component: PartySlot,
  args: { slot: 0, member: partySlotMember(), send: () => false },
  parameters: {
    design: {
      host: { className: "ui-screen formation-theme", width: 372.046875 },
      kind: "component",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".party-slot-choice", padding: 16, background: "transparent" },
    },
  },
} satisfies Meta<typeof PartySlot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Occupied: Story = {
  args: { member: partySlotMember() },
  parameters: {
    design: {
      component: "party/slot/occupied",
      targets: [
        {
          id: "party-slot-occupied-default",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party slot / occupied", "portraitState=available"],
          },
          state: "party-slot-player-default",
        },
        {
          id: "party-slot-occupied-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party slot / occupied", "portraitState=available"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".party-slot-choice" }],
          state: "party-slot-player-focus",
        },
      ],
    },
  },
};
export const PortraitFailed: Story = {
  args: { member: partySlotMember({ failedPortrait: "player" }) },

  parameters: {
    design: {
      component: "party/slot/occupied",
      targets: [
        {
          id: "party-slot-occupied-portrait-failed-default",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party slot / occupied", "portraitState=failed"],
          },
          state: "party-slot-player-portrait-failed-default",
        },
      ],
    },
  },
};
