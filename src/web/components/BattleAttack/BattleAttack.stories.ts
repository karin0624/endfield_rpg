import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleAttack from "./BattleAttack.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-attack",
  title: "Components/DS未対応/Battle/Attack",
  component: BattleAttack,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/Attack",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-attack]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { enabled: true, dispatch },
} satisfies Meta<typeof BattleAttack>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/attack/default",
          state: "default",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Attack", "state=default"] },
        },
        {
          id: "battle/attack/hover",
          state: "hover",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Attack", "state=hover"] },
          interaction: [{ type: "hover", selector: "[data-attack]" }],
        },
        {
          id: "battle/attack/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Attack", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-attack]" }],
        },
        {
          id: "battle/attack/hover-focus",
          state: "hover-focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Attack", "state=hover-focus"] },
          interaction: [
            { type: "focus", selector: "[data-attack]" },
            { type: "hover", selector: "[data-attack]" },
          ],
        },
        {
          id: "battle/attack/pressed-focus",
          state: "pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Attack", "state=pressed-focus"],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-attack]" }],
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
          id: "battle/attack/disabled",
          state: "disabled",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Attack", "state=disabled"] },
        },
      ],
    },
  },
};
