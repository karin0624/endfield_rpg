import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleItemUse from "./BattleItemUse.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemuse",
  title: "Components/DS未対応/Battle/ItemUse",
  component: BattleItemUse,
  parameters: {
    design: {
      host: { padding: 128, width: 430 },
      kind: "component",
      component: "Battle/ItemUse",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-item-use]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { enabled: true, dispatch },
} satisfies Meta<typeof BattleItemUse>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/itemuse/default",
          state: "default",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemUse", "state=default"] },
        },
        {
          id: "battle/itemuse/hover",
          state: "hover",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemUse", "state=hover"] },
          interaction: [{ type: "hover", selector: "[data-item-use]" }],
        },
        {
          id: "battle/itemuse/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemUse", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-item-use]" }],
        },
        {
          id: "battle/itemuse/hover-focus",
          state: "hover-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemUse", "state=hover-focus"],
          },
          interaction: [
            { type: "focus", selector: "[data-item-use]" },
            { type: "hover", selector: "[data-item-use]" },
          ],
        },
        {
          id: "battle/itemuse/pressed-focus",
          state: "pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemUse", "state=pressed-focus"],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-item-use]" }],
        },
      ],
    },
  },
};
export const Disabled: Story = {
  args: { enabled: false },
  parameters: {
    design: {
      targets: [
        {
          id: "battle/itemuse/disabled",
          state: "disabled",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemUse", "state=disabled"] },
        },
      ],
    },
  },
};
