import type { Meta, StoryObj } from "@storybook/svelte-vite";
import DungeonOutcomeReturn from "./DungeonOutcomeReturn.svelte";

const meta = {
  id: "dungeon-outcome-return",
  title: "DS未対応/Dungeon/OutcomeReturn",
  component: DungeonOutcomeReturn,
  parameters: {
    design: {
      host: {},
      kind: "component",
      component: "Dungeon/OutcomeReturn",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".dungeon-outcome-return", padding: 24, background: "transparent" },
    },
  },
  args: { label: "ホームへ帰還" },
} satisfies Meta<typeof DungeonOutcomeReturn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "Dungeon/OutcomeReturn/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / outcome / Local Components — DS未対応",
              "Dungeon/OutcomeReturn",
              "state=default",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "Dungeon/OutcomeReturn/default+focus",
          state: "default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / outcome / Local Components — DS未対応",
              "Dungeon/OutcomeReturn",
              "state=default",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".dungeon-outcome-return" }],
        },
        {
          id: "Dungeon/OutcomeReturn/hover",
          state: "hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / outcome / Local Components — DS未対応",
              "Dungeon/OutcomeReturn",
              "state=hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".dungeon-outcome-return" }],
        },
        {
          id: "Dungeon/OutcomeReturn/hover+focus",
          state: "hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / outcome / Local Components — DS未対応",
              "Dungeon/OutcomeReturn",
              "state=hover",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".dungeon-outcome-return" },
            { type: "hover", selector: ".dungeon-outcome-return" },
          ],
        },
      ],
    },
  },
};
