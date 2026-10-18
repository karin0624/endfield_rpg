import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchSkillTrigger from "../../src/web/components/BranchSkillTrigger.svelte";

const meta = {
  id: "dungeon-branch-skill-trigger",
  title: "DS未対応/Dungeon/Recovery/SkillTrigger",
  component: BranchSkillTrigger,
  parameters: { design: { host: {} } },
  args: {},
} satisfies Meta<typeof BranchSkillTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
