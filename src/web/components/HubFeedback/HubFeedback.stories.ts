import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubFeedback from "./HubFeedback.svelte";

const meta = {
  title: "Hub/Feedback",
  component: HubFeedback,
  args: {
    messages: [
      "活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。",
    ],
  },
  parameters: {
    design: {
      host: { className: "hub-theme", width: "max-content" },
      kind: "component",
      component: "hub/feedback",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".result", padding: 8, background: "#192327" },
    },
  },
} satisfies Meta<typeof HubFeedback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Scrollable: Story = {
  args: {},
  parameters: {
    design: {
      targets: [
        {
          id: "hub/feedback/scroll/default",
          state: "scroll/default",
          figma: {
            path: ["Components / Hub", "Hub/Feedback", "focusVisible=false"],
            properties: {
              text: "活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。",
              focusVisible: "false",
            },
          },
        },
        {
          id: "hub/feedback/scroll/focus",
          state: "scroll/focus",
          figma: {
            path: ["Components / Hub", "Hub/Feedback", "focusVisible=true"],
            properties: {
              text: "活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。\n活動の結果を確認してください。",
              focusVisible: "true",
            },
          },
          interaction: [{ type: "focus", selector: ".result" }],
        },
      ],
    },
  },
};
