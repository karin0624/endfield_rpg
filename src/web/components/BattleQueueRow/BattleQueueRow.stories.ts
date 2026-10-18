import type { Meta, StoryObj } from "@storybook/svelte-vite";
import type { ComponentProps } from "svelte";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleQueueRow from "./BattleQueueRow.svelte";

const member: ComponentProps<typeof BattleQueueRow>["member"] = {
  id: "player",
  name: "ロッシ",
  portrait: "characters/rossi/face.png",
  current: false,
  enemy: false,
  ticks: 5,
  label: "ロッシ、次の行動まで 5 tick",
};

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
  args: { member: member },
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
  args: { member: { ...member, current: true, label: "ロッシ" } },
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
