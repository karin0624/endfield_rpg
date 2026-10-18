import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchItemTrigger from "../../src/web/components/BranchItemTrigger.svelte";
import { dungeonFrame } from "./dungeon-data";

const meta = {
  id: "dungeon-branch-item-trigger",
  title: "DS未対応/Dungeon/Recovery/ItemTrigger",
  component: BranchItemTrigger,
  parameters: { design: { host: { width: 1800 } } },
  args: { label: dungeonFrame().branch.itemLabel, disabled: false },
} satisfies Meta<typeof BranchItemTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true, label: dungeonFrame({ itemCount: 0 }).branch.itemLabel } };
