import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleSkillBack from "../../src/web/components/BattleSkillBack.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillback",
  title: "Components/DS未対応/Battle/SkillBack",
  component: BattleSkillBack,
  parameters: { design: { host: { padding: 128, width: 320.625 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { dispatch },
} satisfies Meta<typeof BattleSkillBack>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
