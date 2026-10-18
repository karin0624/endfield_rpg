import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleAllyCard from "../../src/web/components/BattleAllyCard.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-allycard",
  title: "Components/DS未対応/Battle/AllyCard",
  component: BattleAllyCard,
  parameters: { design: { host: { padding: 128, width: 337.5 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { member: battleStoryFrame({ state: "active", hp: "full" }, "ally").allies[0], dispatch },
} satisfies Meta<typeof BattleAllyCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Waiting: Story = {
  args: { member: battleStoryFrame({ state: "waiting", hp: "full" }, "ally").allies[0] },
};
export const Defeated: Story = {
  args: { member: battleStoryFrame({ state: "defeated", hp: "zero" }, "ally").allies[0] },
};
