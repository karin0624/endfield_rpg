import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BattleTimeline from "../../src/web/components/BattleTimeline.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const meta = {
  id: "battle-timeline",
  title: "Components/DS未対応/Battle/Timeline",
  component: BattleTimeline,
  parameters: { design: { host: { padding: 128, width: 288 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { queue: battleStoryFrame({}, "queue").queue },
} satisfies Meta<typeof BattleTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
