import type { Meta, StoryObj } from "@storybook/svelte-vite";
import DungeonOutcomeReturn from "../../src/web/components/DungeonOutcomeReturn.svelte";

const meta = {
  id: "dungeon-outcome-return",
  title: "DS未対応/Dungeon/OutcomeReturn",
  component: DungeonOutcomeReturn,
  parameters: { design: { host: {} } },
  args: { label: "ホームへ帰還" },
} satisfies Meta<typeof DungeonOutcomeReturn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
