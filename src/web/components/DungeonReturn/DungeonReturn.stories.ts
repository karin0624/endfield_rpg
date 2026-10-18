import type { Meta, StoryObj } from "@storybook/svelte-vite";
import DungeonReturn from "./DungeonReturn.svelte";

const meta = {
  id: "dungeon-return",
  title: "DS未対応/Dungeon/Return",
  component: DungeonReturn,
  parameters: {
    design: {
      host: {},
      kind: "component",
      component: "Dungeon/Return",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".dungeon-town-link", padding: 24, background: "transparent" },
    },
  },
  args: { label: "ホームへ帰還" },
} satisfies Meta<typeof DungeonReturn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "Dungeon/Return/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/Return",
              "state=default",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "Dungeon/Return/default+focus",
          state: "default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/Return",
              "state=default",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".dungeon-town-link" }],
        },
        {
          id: "Dungeon/Return/hover",
          state: "hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/Return",
              "state=hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".dungeon-town-link" }],
        },
        {
          id: "Dungeon/Return/hover+focus",
          state: "hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/Return",
              "state=hover",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".dungeon-town-link" },
            { type: "hover", selector: ".dungeon-town-link" },
          ],
        },
      ],
    },
  },
};
