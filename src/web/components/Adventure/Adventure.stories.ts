import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { adventureSettings, conversationFrame } from "../../../../.storybook/fixtures/adventure-data";
import Adventure from "./Adventure.svelte";

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
    frame: conversationFrame(),
    utilities: conversationFrame().utilities,
    settings: adventureSettings,
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
  args: { frame: conversationFrame("choice") },
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
  args: { frame: conversationFrame("choice"), send: fn(() => false) },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /掲示板の依頼について聞く/ }));
    await expect(args.send).toHaveBeenCalledWith({ type: "choose", optionId: "ask-quest" });
    await expect(args.send).not.toHaveBeenCalledWith({ type: "advance" });
  },
};
