import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchItemUse from "../../src/web/components/BranchItemUse.svelte";

const meta = {
  id: "dungeon-branch-item-use",
  title: "DS未対応/Dungeon/Recovery/ItemUse",
  component: BranchItemUse,
  parameters: { design: { host: { width: 430 } } },
  args: { disabled: false },
} satisfies Meta<typeof BranchItemUse>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
