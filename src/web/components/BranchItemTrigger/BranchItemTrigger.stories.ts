import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { dungeonFrame } from "../../../../.storybook/fixtures/dungeon-data";
import BranchItemTrigger from "./BranchItemTrigger.svelte";

const meta = {
  id: "dungeon-branch-item-trigger",
  title: "DS未対応/Dungeon/Recovery/ItemTrigger",
  component: BranchItemTrigger,
  parameters: {
    design: {
      host: { width: 1800 },
      kind: "component",
      component: "BranchRecovery/ItemTrigger",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".item-trigger", padding: 24, background: "transparent" },
    },
  },
  args: { label: dungeonFrame().branch.itemLabel, disabled: false },
} satisfies Meta<typeof BranchItemTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/ItemTrigger/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/ItemTrigger",
              "state=default",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "BranchRecovery/ItemTrigger/default+focus",
          state: "default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/ItemTrigger",
              "state=default",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".item-trigger" }],
        },
        {
          id: "BranchRecovery/ItemTrigger/hover",
          state: "hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/ItemTrigger",
              "state=hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".item-trigger" }],
        },
        {
          id: "BranchRecovery/ItemTrigger/hover+focus",
          state: "hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/ItemTrigger",
              "state=hover",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".item-trigger" },
            { type: "hover", selector: ".item-trigger" },
          ],
        },
        {
          id: "BranchRecovery/ItemTrigger/pressed+focus",
          state: "pressed+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/ItemTrigger",
              "state=pressed",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".item-trigger" },
            { type: "pressed", selector: ".item-trigger", method: "keyboard" },
          ],
        },
      ],
    },
  },
};
export const Disabled: Story = {
  args: { disabled: true, label: dungeonFrame({ itemCount: 0 }).branch.itemLabel },
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/ItemTrigger/disabled",
          state: "disabled",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/ItemTrigger",
              "state=disabled",
            ],
            properties: { focusVisible: false, label: "物品（HP回復品 ×0）" },
          },
        },
        {
          id: "BranchRecovery/ItemTrigger/disabled-hover",
          state: "disabled-hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/ItemTrigger",
              "state=disabled-hover",
            ],
            properties: { focusVisible: false, label: "物品（HP回復品 ×0）" },
          },
          interaction: [{ type: "hover", selector: ".item-trigger" }],
        },
      ],
    },
  },
};
