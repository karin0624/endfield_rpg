import type { Meta, StoryObj } from "@storybook/svelte-vite";
import PartyDetailAction from "./PartyDetailAction.svelte";

const meta = {
  title: "Party/DetailAction",
  component: PartyDetailAction,
  args: { name: "ロッシ", characterId: "player" },
  parameters: {
    design: {
      host: { className: "ui-screen formation-theme", width: "max-content" },
      kind: "component",
      component: "party/detail-action",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".party-detail", padding: 16, background: "transparent" },
    },
  },
} satisfies Meta<typeof PartyDetailAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  parameters: {
    design: {
      targets: [
        {
          id: "party-detail-default",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party detail action"] },
          state: "party-detail-default",
        },
        {
          id: "party-detail-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party detail action"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".party-detail" }],
          state: "party-detail-focus",
        },
      ],
    },
  },
};
