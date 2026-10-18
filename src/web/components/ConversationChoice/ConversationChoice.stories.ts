import type { Meta, StoryObj } from "@storybook/svelte-vite";
import ConversationChoice from "./ConversationChoice.svelte";

const meta = {
  id: "adventure-conversation-choice",
  title: "DS未対応/Conversation/Choice",
  component: ConversationChoice,
  parameters: {
    design: {
      host: { width: 980 },
      kind: "component",
      component: "Adventure/ConversationChoice",
      viewport: { width: 2048, height: 1208 },
      capture: { selector: ".conversation-choice", padding: 24, background: "transparent" },
    },
  },
  args: {
    option: { id: "design-choice", number: 1, label: "掲示板の依頼について聞く" },
    choose: () => {},
    focused: () => {},
  },
} satisfies Meta<typeof ConversationChoice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "Adventure/ConversationChoice/default",
          state: "default",
          figma: {
            path: ["Components / DS未対応", "Adventure — DS未対応", "Adventure/ConversationChoice", "state=default"],
            properties: { focusVisible: false },
          },
        },
        {
          id: "Adventure/ConversationChoice/default+focus",
          state: "default+focus",
          figma: {
            path: ["Components / DS未対応", "Adventure — DS未対応", "Adventure/ConversationChoice", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".conversation-choice" }],
        },
        {
          id: "Adventure/ConversationChoice/hover",
          state: "hover",
          figma: {
            path: ["Components / DS未対応", "Adventure — DS未対応", "Adventure/ConversationChoice", "state=hover"],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".conversation-choice" }],
        },
        {
          id: "Adventure/ConversationChoice/hover+focus",
          state: "hover+focus",
          figma: {
            path: ["Components / DS未対応", "Adventure — DS未対応", "Adventure/ConversationChoice", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".conversation-choice" },
            { type: "hover", selector: ".conversation-choice" },
          ],
        },
      ],
    },
  },
};
