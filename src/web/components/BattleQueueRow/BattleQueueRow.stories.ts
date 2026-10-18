import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleQueueRow from "./BattleQueueRow.svelte";

const meta = {
  id: "battle-queuerow",
  title: "Components/DS未対応/Battle/QueueRow",
  component: BattleQueueRow,
  parameters: {
    design: {
      host: { padding: 128, width: 262.5 },
      kind: "component",
      component: "Battle/QueueRow",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".queue-row", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { member: battleStoryFrame({ ticks: 5 }, "queue").queue[0] },
} satisfies Meta<typeof BattleQueueRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/queuerow/current-false_enemy-false_ticks-5",
          state: "current-false_enemy-false_ticks-5",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / QueueRow", "current=false"] },
        },
      ],
    },
  },
};
export const Current: Story = {
  args: { member: battleStoryFrame({ ticks: 5, current: true }, "queue").queue[0] },
  parameters: {
    design: {
      targets: [
        {
          id: "battle/queuerow/current-true_enemy-false_ticks-5",
          state: "current-true_enemy-false_ticks-5",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / QueueRow", "current=true"] },
        },
      ],
    },
  },
};
