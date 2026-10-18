import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleSkillsTrigger from "./BattleSkillsTrigger.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillstrigger",
  title: "Components/DS未対応/Battle/SkillsTrigger",
  component: BattleSkillsTrigger,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/SkillsTrigger",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-skills]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { enabled: true, dispatch },
} satisfies Meta<typeof BattleSkillsTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/skillstrigger/default",
          state: "default",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillsTrigger", "state=default"],
          },
        },
        {
          id: "battle/skillstrigger/hover",
          state: "hover",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillsTrigger", "state=hover"],
          },
          interaction: [{ type: "hover", selector: "[data-skills]" }],
        },
        {
          id: "battle/skillstrigger/focus",
          state: "focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillsTrigger", "state=focus"],
          },
          interaction: [{ type: "focus", selector: "[data-skills]" }],
        },
        {
          id: "battle/skillstrigger/hover-focus",
          state: "hover-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillsTrigger", "state=hover-focus"],
          },
          interaction: [
            { type: "focus", selector: "[data-skills]" },
            { type: "hover", selector: "[data-skills]" },
          ],
        },
        {
          id: "battle/skillstrigger/pressed-focus",
          state: "pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillsTrigger", "state=pressed-focus"],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-skills]" }],
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
          id: "battle/skillstrigger/disabled",
          state: "disabled",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillsTrigger", "state=disabled"],
          },
        },
      ],
    },
  },
};
