import type { Meta, StoryObj } from "@storybook/svelte-vite";
import ConversationChoice from "../../src/web/components/ConversationChoice.svelte";

const meta = {
  id: "adventure-conversation-choice",
  title: "DS未対応/Conversation/Choice",
  component: ConversationChoice,
  parameters: { design: { host: { width: 980 } } },
  args: {
    option: { id: "design-choice", number: 1, label: "掲示板の依頼について聞く" },
    choose: () => {},
    focused: () => {},
  },
} satisfies Meta<typeof ConversationChoice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
