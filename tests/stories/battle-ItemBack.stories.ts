import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleItemBack from "../../src/web/components/BattleItemBack.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemback",
  title: "Components/DS未対応/Battle/ItemBack",
  component: BattleItemBack,
  parameters: { design: { host: { padding: 128, width: 430 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { dispatch },
} satisfies Meta<typeof BattleItemBack>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
