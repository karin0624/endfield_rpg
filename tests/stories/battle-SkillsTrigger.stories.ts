import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleSkillsTrigger from "../../src/web/components/BattleSkillsTrigger.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillstrigger",
  title: "Components/DS未対応/Battle/SkillsTrigger",
  component: BattleSkillsTrigger,
  parameters: { design: { host: { padding: 128, width: 320.625 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { enabled: true, dispatch },
} satisfies Meta<typeof BattleSkillsTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { enabled: false } };
