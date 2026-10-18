import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleResult from "./BattleResult.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-result",
  title: "Components/DS未対応/Battle/Result",
  component: BattleResult,
  parameters: {
    design: {
      host: { padding: 128, width: 557.75 },
      kind: "component",
      component: "Battle/Result",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".battle-result", padding: 32, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
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
} satisfies Meta<typeof BattleResult>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/result/victory_default",
          state: "victory_default",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Result", "state=default"] },
        },
      ],
    },
  },
};
