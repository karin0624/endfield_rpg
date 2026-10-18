import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleItemBack from "./BattleItemBack.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemback",
  title: "Components/DS未対応/Battle/ItemBack",
  component: BattleItemBack,
  parameters: {
    design: {
      host: { padding: 128, width: 430 },
      kind: "component",
      component: "Battle/ItemBack",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-item-cancel]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { dispatch },
} satisfies Meta<typeof BattleItemBack>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/itemback/default",
          state: "default",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemBack", "state=default"] },
        },
        {
          id: "battle/itemback/hover",
          state: "hover",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemBack", "state=hover"] },
          interaction: [{ type: "hover", selector: "[data-item-cancel]" }],
        },
        {
          id: "battle/itemback/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemBack", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-item-cancel]" }],
        },
        {
          id: "battle/itemback/hover-focus",
          state: "hover-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemBack", "state=hover-focus"],
          },
          interaction: [
            { type: "focus", selector: "[data-item-cancel]" },
            { type: "hover", selector: "[data-item-cancel]" },
          ],
        },
        {
          id: "battle/itemback/pressed-focus",
          state: "pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemBack", "state=pressed-focus"],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-item-cancel]" }],
        },
      ],
    },
  },
};
