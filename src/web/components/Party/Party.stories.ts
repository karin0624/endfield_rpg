import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { partyFrame } from "../../../../.storybook/fixtures/party-model";
import Party from "./Party.svelte";

const meta = {
  title: "Screens/Party",
  component: Party,
  args: { send: () => false },
  parameters: { design: { host: { padding: 0 }, kind: "screen", viewport: { width: 1920, height: 1080 } } },
} satisfies Meta<typeof Party>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Formation: Story = {
  args: { frame: partyFrame({ members: 2, edit: true }) },
  parameters: {
    design: {
      targets: [{ id: "screen-party", figma: { path: ["Screens / DS未対応", "Party"] }, state: "screen-party" }],
    },
  },
};
export const Departure: Story = {
  args: { frame: partyFrame({ members: 2, edit: false }) },
  parameters: {
    design: {
      targets: [
        { id: "screen-departure", figma: { path: ["Screens / DS未対応", "Departure"] }, state: "screen-departure" },
      ],
    },
  },
};
export const Selection: Story = {
  args: { frame: partyFrame({ members: 2 }, "selection") },
  parameters: {
    design: {
      targets: [
        {
          id: "screen-party-selection",
          figma: { path: ["Screens / DS未対応", "Party Selection"] },
          state: "screen-party-selection",
        },
      ],
    },
  },
};
export const CharacterDetails: Story = {
  args: { frame: partyFrame({ members: 2 }, "details") },
  parameters: {
    design: {
      targets: [
        {
          id: "screen-character-details",
          figma: { path: ["Screens / DS未対応", "Character Details"] },
          state: "screen-character-details",
        },
      ],
    },
  },
};
