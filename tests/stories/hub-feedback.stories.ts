import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubFeedback from "../../src/web/components/HubFeedback.svelte";

const meta = {
  title: "Hub/Feedback",
  component: HubFeedback,
  args: {
    messages: [
      "活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。",
    ],
  },
  parameters: { design: { host: { className: "hub-theme", width: "max-content" } } },
} satisfies Meta<typeof HubFeedback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Scrollable: Story = { args: {} };
