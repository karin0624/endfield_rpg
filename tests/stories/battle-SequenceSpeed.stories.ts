import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleSequenceSpeed from "../../src/web/components/BattleSequenceSpeed.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-sequencespeed",
  title: "Components/DS未対応/Battle/SequenceSpeed",
  component: BattleSequenceSpeed,
  parameters: { design: { host: { padding: 128 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "sequence" } })],
  args: { speed: 1, dispatch },
} satisfies Meta<typeof BattleSequenceSpeed>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
