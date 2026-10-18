import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchItemPanel from "../../src/web/components/BranchItemPanel.svelte";
import { dungeonFrame } from "./dungeon-data";

const meta = {
  id: "dungeon-branch-item-dialog",
  title: "DS未対応/Dungeon/Recovery/ItemDialog",
  component: BranchItemPanel,
  parameters: { design: { host: { width: 480 } } },
  args: { frame: dungeonFrame({ panel: "item" }).branch, send: () => false },
} satisfies Meta<typeof BranchItemPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};
