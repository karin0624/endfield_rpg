import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleEnemyHitbox from "../../src/web/components/BattleEnemyHitbox.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-enemyhitbox",
  title: "Components/DS未対応/Battle/EnemyHitbox",
  component: BattleEnemyHitbox,
  parameters: { design: { host: { padding: 128, width: 180, height: 160 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow", scope: "enemy" } })],
  args: { member: battleStoryFrame({}, "hitbox").enemies[0], dispatch },
} satisfies Meta<typeof BattleEnemyHitbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
