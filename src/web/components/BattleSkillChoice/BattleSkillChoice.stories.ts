import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleSkillChoice from "./BattleSkillChoice.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillchoice",
  title: "Components/DS未対応/Battle/SkillChoice",
  component: BattleSkillChoice,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/SkillChoice",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-skill-id]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { skillId: "test-heal", label: "回復術", selected: false, dispatch },
} satisfies Meta<typeof BattleSkillChoice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/skillchoice/default_selected-false",
          state: "default_selected-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=default, selected=false",
            ],
          },
        },
        {
          id: "battle/skillchoice/hover_selected-false",
          state: "hover_selected-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=hover, selected=false",
            ],
          },
          interaction: [{ type: "hover", selector: "[data-skill-id]" }],
        },
        {
          id: "battle/skillchoice/focus_selected-false",
          state: "focus_selected-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=focus, selected=false",
            ],
          },
          interaction: [{ type: "focus", selector: "[data-skill-id]" }],
        },
        {
          id: "battle/skillchoice/hover-focus_selected-false",
          state: "hover-focus_selected-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=hover-focus, selected=false",
            ],
          },
          interaction: [
            { type: "focus", selector: "[data-skill-id]" },
            { type: "hover", selector: "[data-skill-id]" },
          ],
        },
        {
          id: "battle/skillchoice/pressed-focus_selected-false",
          state: "pressed-focus_selected-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=pressed-focus, selected=false",
            ],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-skill-id]" }],
        },
      ],
    },
  },
};
export const Selected: Story = {
  args: { selected: true },
  parameters: {
    design: {
      targets: [
        {
          id: "battle/skillchoice/default_selected-true",
          state: "default_selected-true",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=default, selected=true",
            ],
          },
        },
        {
          id: "battle/skillchoice/focus_selected-true",
          state: "focus_selected-true",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=focus, selected=true",
            ],
          },
          interaction: [{ type: "focus", selector: "[data-skill-id]" }],
        },
        {
          id: "battle/skillchoice/pressed-focus_selected-true",
          state: "pressed-focus_selected-true",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SkillChoice",
              "state=pressed-focus, selected=true",
            ],
          },
          interaction: [{ type: "pressed", method: "keyboard", selector: "[data-skill-id]" }],
        },
      ],
    },
  },
};
