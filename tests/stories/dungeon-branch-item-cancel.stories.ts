import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchItemCancel from "../../src/web/components/BranchItemCancel.svelte";

const meta = {
  id: "dungeon-branch-item-cancel",
  title: "DS未対応/Dungeon/Recovery/ItemCancel",
  component: BranchItemCancel,
  parameters: { design: { host: { width: 430 } } },
  args: {},
} satisfies Meta<typeof BranchItemCancel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
