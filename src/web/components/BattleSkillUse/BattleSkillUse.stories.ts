import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleSkillUse from "./BattleSkillUse.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skilluse",
  title: "Components/DS未対応/Battle/SkillUse",
  component: BattleSkillUse,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/SkillUse",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-use-skill]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { enabled: true, dispatch },
} satisfies Meta<typeof BattleSkillUse>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/skilluse/default",
          state: "default",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillUse", "state=default"] },
        },
        {
          id: "battle/skilluse/hover",
          state: "hover",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillUse", "state=hover"] },
          interaction: [{ type: "hover", selector: "[data-use-skill]" }],
        },
        {
          id: "battle/skilluse/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillUse", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-use-skill]" }],
        },
        {
          id: "battle/skilluse/hover-focus",
          state: "hover-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillUse", "state=hover-focus"],
          },
          interaction: [
            { type: "focus", selector: "[data-use-skill]" },
            { type: "hover", selector: "[data-use-skill]" },
          ],
        },
        {
          id: "battle/skilluse/pressed-focus",
          state: "pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillUse", "state=pressed-focus"],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-use-skill]" }],
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
          id: "battle/skilluse/disabled",
          state: "disabled",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillUse", "state=disabled"] },
        },
      ],
    },
  },
};
