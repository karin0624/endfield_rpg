import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchSkillButton from "../../src/web/components/BranchSkillButton.svelte";

const meta = {
  id: "dungeon-branch-skill-button",
  title: "DS未対応/Dungeon/Recovery/SkillButton",
  component: BranchSkillButton,
  parameters: { design: { host: { width: 478 } } },
  args: { label: "ロッシ", "data-branch-focus": "actor" },
} satisfies Meta<typeof BranchSkillButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
