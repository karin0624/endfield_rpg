import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchItemUse from "./BranchItemUse.svelte";

const meta = {
  id: "dungeon-branch-item-use",
  title: "DS未対応/Dungeon/Recovery/ItemUse",
  component: BranchItemUse,
  parameters: {
    design: {
      host: { width: 430 },
      kind: "component",
      component: "BranchRecovery/ItemUse",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: "[data-item-use]", padding: 24, background: "transparent" },
    },
  },
  args: { disabled: false },
} satisfies Meta<typeof BranchItemUse>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/ItemUse/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemUse",
              "state=default",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "BranchRecovery/ItemUse/default+focus",
          state: "default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemUse",
              "state=default",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: "[data-item-use]" }],
        },
        {
          id: "BranchRecovery/ItemUse/hover",
          state: "hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemUse",
              "state=hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: "[data-item-use]" }],
        },
        {
          id: "BranchRecovery/ItemUse/hover+focus",
          state: "hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemUse",
              "state=hover",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: "[data-item-use]" },
            { type: "hover", selector: "[data-item-use]" },
          ],
        },
        {
          id: "BranchRecovery/ItemUse/pressed+focus",
          state: "pressed+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemUse",
              "state=pressed",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: "[data-item-use]" },
            { type: "pressed", selector: "[data-item-use]", method: "keyboard" },
          ],
        },
      ],
    },
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/ItemUse/disabled",
          state: "disabled",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemUse",
              "state=disabled",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "BranchRecovery/ItemUse/disabled-hover",
          state: "disabled-hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemUse",
              "state=disabled-hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: "[data-item-use]" }],
        },
      ],
    },
  },
};
