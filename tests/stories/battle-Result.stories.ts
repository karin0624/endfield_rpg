import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleResult from "../../src/web/components/BattleResult.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-result",
  title: "Components/DS未対応/Battle/Result",
  component: BattleResult,
  parameters: { design: { host: { padding: 128, width: 557.75 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { result: battleStoryFrame({}, "result").result, dispatch },
} satisfies Meta<typeof BattleResult>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
