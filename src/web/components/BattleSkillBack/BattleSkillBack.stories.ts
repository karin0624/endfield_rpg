import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleSkillBack from "./BattleSkillBack.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillback",
  title: "Components/DS未対応/Battle/SkillBack",
  component: BattleSkillBack,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/SkillBack",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-cancel-skill]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { dispatch },
} satisfies Meta<typeof BattleSkillBack>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/skillback/default",
          state: "default",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillBack", "state=default"] },
        },
        {
          id: "battle/skillback/hover",
          state: "hover",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillBack", "state=hover"] },
          interaction: [{ type: "hover", selector: "[data-cancel-skill]" }],
        },
        {
          id: "battle/skillback/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillBack", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-cancel-skill]" }],
        },
        {
          id: "battle/skillback/hover-focus",
          state: "hover-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillBack", "state=hover-focus"],
          },
          interaction: [
            { type: "focus", selector: "[data-cancel-skill]" },
            { type: "hover", selector: "[data-cancel-skill]" },
          ],
        },
        {
          id: "battle/skillback/pressed-focus",
          state: "pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillBack", "state=pressed-focus"],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-cancel-skill]" }],
        },
      ],
    },
  },
};
