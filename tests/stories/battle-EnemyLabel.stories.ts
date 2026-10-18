import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BattleEnemyLabel from "../../src/web/components/BattleEnemyLabel.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const meta = {
  id: "battle-enemylabel",
  title: "Components/DS未対応/Battle/EnemyLabel",
  component: BattleEnemyLabel,
  parameters: { design: { host: { padding: 128 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow", scope: "enemy" } })],
  args: { member: battleStoryFrame({ hp: "full" }, "enemy").enemies[0] },
} satisfies Meta<typeof BattleEnemyLabel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = {
  args: { member: battleStoryFrame({ selected: true, hp: "full" }, "enemy").enemies[0] },
};
export const Defeated: Story = {
  args: { member: battleStoryFrame({ defeated: true, hp: "zero" }, "enemy").enemies[0] },
};
