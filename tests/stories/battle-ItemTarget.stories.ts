import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleItemTarget from "../../src/web/components/BattleItemTarget.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemtarget",
  title: "Components/DS未対応/Battle/ItemTarget",
  component: BattleItemTarget,
  parameters: { design: { host: { padding: 128, width: 430 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { value: "player", options: battleStoryFrame({}, "item").items.targets, dispatch },
} satisfies Meta<typeof BattleItemTarget>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
