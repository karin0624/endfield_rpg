import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { rossiDetails } from "../../../../.storybook/fixtures/character-details-data";
import type { PartyFrame } from "../../../presentation/partyProjection";
import Party from "./Party.svelte";

const rossi = {
  id: "player",
  name: "ロッシ",
  hp: "HP 20/20",
  ratio: 1,
  symptoms: "",
  portrait: "characters/rossi/expressions/neutral.png",
};
const gilberta = {
  id: "gilberta",
  name: "ギルベルタ",
  hp: "HP 18/18",
  ratio: 1,
  symptoms: "",
  portrait: "characters/gilberta/expressions/neutral.png",
};
const candidates = [
  { ...rossi, number: 1, unavailable: false, reason: "", selectionLabel: "隊列 1" },
  { ...gilberta, number: 2, unavailable: false, reason: "", selectionLabel: "隊列 2" },
];
const frame: PartyFrame = {
  visible: true,
  title: "出発準備",
  calendar: "1日目 · 昼",
  slots: [
    { slot: 0, member: rossi },
    { slot: 1, member: gilberta },
    { slot: 2, member: null },
    { slot: 3, member: null },
  ],
  departure: { visible: true, disabled: false },
  status: "",
  selection: null,
  details: { active: true, dialog: null, generation: 0, focus: null, scrollTop: 0 },
  focus: null,
  portraitGeneration: 0,
};

const meta = {
  title: "Screens/Party",
  component: Party,
  args: { send: () => false },
  parameters: { design: { host: { padding: 0 }, kind: "screen", viewport: { width: 1920, height: 1080 } } },
} satisfies Meta<typeof Party>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Formation: Story = {
  args: { frame: { ...frame, title: "編成", departure: { visible: false, disabled: false } } },
  parameters: {
    design: {
      targets: [{ id: "screen-party", figma: { path: ["Screens / DS未対応", "Party"] }, state: "screen-party" }],
    },
  },
};
export const Departure: Story = {
  args: { frame: { ...frame, title: "出発準備", departure: { visible: true, disabled: false } } },
  parameters: {
    design: {
      targets: [
        { id: "screen-departure", figma: { path: ["Screens / DS未対応", "Departure"] }, state: "screen-departure" },
      ],
    },
  },
};
export const Selection: Story = {
  args: { frame: { ...frame, selection: { scrollTop: 0, status: "", candidates } } },
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
  args: {
    frame: {
      ...frame,
      selection: { scrollTop: 0, status: "", candidates },
      details: { ...frame.details, dialog: rossiDetails, generation: 1 },
    },
  },
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
