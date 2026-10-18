import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleItemDialogPanel from "../../src/web/components/BattleItemDialogPanel.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemdialog",
  title: "Components/DS未対応/Battle/ItemDialog",
  component: BattleItemDialogPanel,
  parameters: { design: { host: { padding: 128 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { items: battleStoryFrame({}, "item").items, dispatch },
} satisfies Meta<typeof BattleItemDialogPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
