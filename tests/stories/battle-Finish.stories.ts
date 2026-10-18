import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleFinish from "../../src/web/components/BattleFinish.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-finish",
  title: "Components/DS未対応/Battle/Finish",
  component: BattleFinish,
  parameters: { design: { host: { padding: 128 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "finish" } })],
  args: { result: battleStoryFrame({}, "result").result, dispatch },
} satisfies Meta<typeof BattleFinish>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
