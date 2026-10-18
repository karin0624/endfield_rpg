import type { Meta, StoryObj } from "@storybook/svelte-vite";
import DialoguePanel from "../../src/web/components/DialoguePanel.svelte";

const meta = {
  id: "adventure-dialogue-panel",
  title: "DS未対応/Conversation/Dialogue",
  component: DialoguePanel,
  parameters: { design: { host: { width: 1920 } } },
  args: { type: "line", speaker: "ロッシ", text: "ロッシは掲示板の前で足を止めた。" },
} satisfies Meta<typeof DialoguePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {};
export const Choice: Story = { args: { type: "choice" } };
