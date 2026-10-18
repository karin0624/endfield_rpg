import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleSkillChoice from "../../src/web/components/BattleSkillChoice.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillchoice",
  title: "Components/DS未対応/Battle/SkillChoice",
  component: BattleSkillChoice,
  parameters: { design: { host: { padding: 128, width: 320.625 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { skillId: "test-heal", label: "回復術", selected: false, dispatch },
} satisfies Meta<typeof BattleSkillChoice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
