import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleItemTrigger from "./BattleItemTrigger.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemtrigger",
  title: "Components/DS未対応/Battle/ItemTrigger",
  component: BattleItemTrigger,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/ItemTrigger",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-focus=item]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { label: "物品（HP回復品 ×3）", enabled: true, dispatch },
} satisfies Meta<typeof BattleItemTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/itemtrigger/default",
          state: "default",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemTrigger", "state=default"],
          },
        },
        {
          id: "battle/itemtrigger/hover",
          state: "hover",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemTrigger", "state=hover"] },
          interaction: [{ type: "hover", selector: "[data-focus=item]" }],
        },
        {
          id: "battle/itemtrigger/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemTrigger", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-focus=item]" }],
        },
        {
          id: "battle/itemtrigger/hover-focus",
          state: "hover-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemTrigger", "state=hover-focus"],
          },
          interaction: [
            { type: "focus", selector: "[data-focus=item]" },
            { type: "hover", selector: "[data-focus=item]" },
          ],
        },
        {
          id: "battle/itemtrigger/pressed-focus",
          state: "pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemTrigger", "state=pressed-focus"],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-focus=item]" }],
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
          id: "battle/itemtrigger/disabled",
          state: "disabled",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemTrigger", "state=disabled"],
          },
        },
      ],
    },
  },
};
