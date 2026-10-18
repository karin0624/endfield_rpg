import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleCommands from "../../src/web/components/BattleCommands.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-commands",
  title: "Components/DS未対応/Battle/Commands",
  component: BattleCommands,
  parameters: { design: { host: { padding: 128, width: 352 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { frame: battleStoryFrame(), dispatch },
} satisfies Meta<typeof BattleCommands>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
