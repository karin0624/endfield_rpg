import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleSequenceSkip from "../../src/web/components/BattleSequenceSkip.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-sequenceskip",
  title: "Components/DS未対応/Battle/SequenceSkip",
  component: BattleSequenceSkip,
  parameters: { design: { host: { padding: 128 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "sequence" } })],
  args: { dispatch },
} satisfies Meta<typeof BattleSequenceSkip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
