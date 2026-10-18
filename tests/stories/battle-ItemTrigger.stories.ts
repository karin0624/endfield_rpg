import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleItemTrigger from "../../src/web/components/BattleItemTrigger.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemtrigger",
  title: "Components/DS未対応/Battle/ItemTrigger",
  component: BattleItemTrigger,
  parameters: { design: { host: { padding: 128, width: 320.625 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { label: "物品（HP回復品 ×3）", enabled: true, dispatch },
} satisfies Meta<typeof BattleItemTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { enabled: false } };
