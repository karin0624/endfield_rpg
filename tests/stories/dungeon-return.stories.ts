import type { Meta, StoryObj } from "@storybook/svelte-vite";
import DungeonReturn from "../../src/web/components/DungeonReturn.svelte";

const meta = {
  id: "dungeon-return",
  title: "DS未対応/Dungeon/Return",
  component: DungeonReturn,
  parameters: { design: { host: {} } },
  args: { label: "ホームへ帰還" },
} satisfies Meta<typeof DungeonReturn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
