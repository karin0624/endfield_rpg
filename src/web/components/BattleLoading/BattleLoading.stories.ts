import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleLoading from "./BattleLoading.svelte";

const meta = {
  id: "battle-loading",
  title: "Components/DS未対応/Battle/Loading",
  component: BattleLoading,
  parameters: {
    design: {
      host: { padding: 0, width: 640, height: 360 },
      kind: "component",
      component: "Battle/Loading",
      viewport: { width: 640, height: 360 },
      capture: { selector: ".loading", padding: 0, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow", scope: "enemy" } })],
  args: { ready: false, error: false, message: "戦闘を準備しています…" },
} satisfies Meta<typeof BattleLoading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/loading/loading",
          state: "loading",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleSurface / Loading", "state=default"],
          },
        },
      ],
    },
  },
};
