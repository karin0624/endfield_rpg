import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { AdventureFrame } from "../../../presentation/adventureProjection";
import { parseAdventureSettings } from "../../../presentation/adventureSettings";
import savedSettings from "../../adventure-settings.json";
import Adventure from "./Adventure.svelte";

const frame: AdventureFrame = {
  mode: "conversation",
  backgroundId: "guild-hall",
  backgroundPath: "backgrounds/landscape1.png",
  calendar: "1日目 · 昼",
  feedback: [],
  prompt: "",
  status: "会話中",
  places: [],
  scene: {
    type: "line",
    speaker: "ロッシ",
    text: "ロッシは掲示板の前で足を止めた。",
    choices: [],
    portraits: [
      { id: "rossi", speaking: true, position: "left", path: "characters/rossi/expressions/neutral.png" },
      { id: "gilberta", speaking: false, position: "center", path: "characters/gilberta/expressions/smile.png" },
    ],
  },
  utilities: { party: false, home: false, debug: false, editor: false },
  saveStatus: "",
  party: undefined,
  focus: null,
};

const meta = {
  id: "adventure-conversation-screen",
  title: "Screens/DS未対応/Conversation",
  component: Adventure,
  parameters: {
    design: {
      host: { width: 1920, height: 1080, padding: 0 },
      kind: "screen",
      viewport: { width: 1920, height: 1080 },
    },
  },
  args: {
    frame,
    utilities: frame.utilities,
    settings: parseAdventureSettings(savedSettings),
    send: () => false,
  },
} satisfies Meta<typeof Adventure>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Conversation / line",
          state: "line",
          figma: { path: ["Screens / DS未対応", "Conversation / line"] },
        },
      ],
    },
  },
};
export const Choice: Story = {
  args: {
    frame: {
      ...frame,
      scene: {
        type: "choice",
        speaker: "ギルベルタ",
        text: "何を聞こう？",
        choices: [
          { id: "ask-quest", label: "掲示板の依頼について聞く", number: 1 },
          { id: "leave", label: "今日は何も聞かない", number: 2 },
        ],
        portraits: [
          { id: "rossi", speaking: false, position: "left", path: "characters/rossi/expressions/neutral.png" },
          { id: "gilberta", speaking: true, position: "center", path: "characters/gilberta/expressions/smile.png" },
        ],
      },
    },
  },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Conversation / choice",
          state: "choice",
          figma: { path: ["Screens / DS未対応", "Conversation / choice"] },
        },
      ],
    },
  },
};

export const ChoiceInteraction: Story = {
  args: { ...Choice.args, send: fn(() => false) },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /掲示板の依頼について聞く/ }));
    await expect(args.send).toHaveBeenCalledWith({ type: "choose", optionId: "ask-quest" });
    await expect(args.send).not.toHaveBeenCalledWith({ type: "advance" });
  },
};
