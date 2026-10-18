import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleSkillPanel from "./BattleSkillPanel.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillpanel",
  title: "Components/DS未対応/Battle/SkillPanel",
  component: BattleSkillPanel,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/SkillPanel",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".skill-panel", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { skills: battleStoryFrame({}, "skills").skills, dispatch },
} satisfies Meta<typeof BattleSkillPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/skillpanel/selected-false_disabled-false",
          state: "selected-false_disabled-false",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SkillPanel", "state=default"] },
        },
      ],
    },
  },
};
