import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchItemCancel from "./BranchItemCancel.svelte";

const meta = {
  id: "dungeon-branch-item-cancel",
  title: "DS未対応/Dungeon/Recovery/ItemCancel",
  component: BranchItemCancel,
  parameters: {
    design: {
      host: { width: 430 },
      kind: "component",
      component: "BranchRecovery/ItemCancel",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: "[data-item-cancel]", padding: 24, background: "transparent" },
    },
  },
  args: {},
} satisfies Meta<typeof BranchItemCancel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/ItemCancel/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemCancel",
              "state=default",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "BranchRecovery/ItemCancel/default+focus",
          state: "default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemCancel",
              "state=default",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: "[data-item-cancel]" }],
        },
        {
          id: "BranchRecovery/ItemCancel/hover",
          state: "hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemCancel",
              "state=hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: "[data-item-cancel]" }],
        },
        {
          id: "BranchRecovery/ItemCancel/hover+focus",
          state: "hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemCancel",
              "state=hover",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: "[data-item-cancel]" },
            { type: "hover", selector: "[data-item-cancel]" },
          ],
        },
        {
          id: "BranchRecovery/ItemCancel/pressed+focus",
          state: "pressed+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemCancel",
              "state=pressed",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: "[data-item-cancel]" },
            { type: "pressed", selector: "[data-item-cancel]", method: "keyboard" },
          ],
        },
      ],
    },
  },
};
