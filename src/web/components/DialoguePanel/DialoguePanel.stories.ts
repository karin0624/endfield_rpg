import type { Meta, StoryObj } from "@storybook/svelte-vite";
import DialoguePanel from "./DialoguePanel.svelte";

const meta = {
  id: "adventure-dialogue-panel",
  title: "DS未対応/Conversation/Dialogue",
  component: DialoguePanel,
  parameters: {
    design: {
      host: { width: 1920 },
      kind: "component",
      component: "Adventure/DialoguePanel",
      viewport: { width: 2048, height: 1208 },
      capture: { selector: ".dialogue-panel", padding: 0, background: "transparent" },
    },
  },
  args: { type: "line", speaker: "ロッシ", text: "ロッシは掲示板の前で足を止めた。" },
} satisfies Meta<typeof DialoguePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "Adventure/DialoguePanel/line",
          state: "line",
          figma: { path: ["Components / DS未対応", "Adventure — DS未対応", "Adventure/DialoguePanel", "type=line"] },
        },
      ],
    },
  },
};
export const Choice: Story = {
  args: { type: "choice" },
  parameters: {
    design: {
      targets: [
        {
          id: "Adventure/DialoguePanel/choice",
          state: "choice",
          figma: { path: ["Components / DS未対応", "Adventure — DS未対応", "Adventure/DialoguePanel", "type=choice"] },
        },
      ],
    },
  },
};
