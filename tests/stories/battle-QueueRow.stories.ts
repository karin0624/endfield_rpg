import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BattleQueueRow from "../../src/web/components/BattleQueueRow.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const meta = {
  id: "battle-queuerow",
  title: "Components/DS未対応/Battle/QueueRow",
  component: BattleQueueRow,
  parameters: { design: { host: { padding: 128, width: 262.5 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { member: battleStoryFrame({ ticks: 5 }, "queue").queue[0] },
} satisfies Meta<typeof BattleQueueRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Current: Story = { args: { member: battleStoryFrame({ ticks: 5, current: true }, "queue").queue[0] } };
