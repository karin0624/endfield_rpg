import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import Adventure from "../../src/web/components/Adventure.svelte";
import { adventureSettings, conversationFrame } from "./adventure-data";

const meta = {
  id: "adventure-conversation-screen",
  title: "Screens/DS未対応/Conversation",
  component: Adventure,
  parameters: { design: { host: { width: 1920, height: 1080, padding: 0 } } },
  args: {
    frame: conversationFrame(),
    utilities: conversationFrame().utilities,
    settings: adventureSettings,
    send: () => false,
  },
} satisfies Meta<typeof Adventure>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};
export const Choice: Story = { args: { frame: conversationFrame("choice") } };

export const ChoiceInteraction: Story = {
  args: { frame: conversationFrame("choice"), send: fn(() => false) },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /掲示板の依頼について聞く/ }));
    await expect(args.send).toHaveBeenCalledWith({ type: "choose", optionId: "ask-quest" });
    await expect(args.send).not.toHaveBeenCalledWith({ type: "advance" });
  },
};
