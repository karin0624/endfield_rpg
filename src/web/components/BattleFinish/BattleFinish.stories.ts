import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleFinish from "./BattleFinish.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-finish",
  title: "Components/DS未対応/Battle/Finish",
  component: BattleFinish,
  parameters: {
    design: {
      host: { padding: 128 },
      kind: "component",
      component: "Battle/Finish",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-rematch]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "finish" } })],
  args: {
    result: {
      visible: true,
      title: "戦闘に勝利しました",
      detail: "敵をすべて倒しました。",
      finishLabel: "再戦する",
      finishAriaLabel: "戦闘を再戦する",
    },
    dispatch,
  },
} satisfies Meta<typeof BattleFinish>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/finish/default",
          state: "default",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Finish", "state=default"] },
        },
        {
          id: "battle/finish/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Finish", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-rematch]" }],
        },
      ],
    },
  },
};
