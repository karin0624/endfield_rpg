import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BattleLoading from "../../src/web/components/BattleLoading.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const meta = {
  id: "battle-loading",
  title: "Components/DS未対応/Battle/Loading",
  component: BattleLoading,
  parameters: { design: { host: { padding: 0, width: 640, height: 360 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow", scope: "enemy" } })],
  args: { ready: false, error: false, message: "戦闘を準備しています…" },
} satisfies Meta<typeof BattleLoading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
