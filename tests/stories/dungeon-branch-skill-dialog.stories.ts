import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchSkillPanel from "../../src/web/components/BranchSkillPanel.svelte";
import { dungeonFrame } from "./dungeon-data";

const meta = {
  id: "dungeon-branch-skill-dialog",
  title: "DS未対応/Dungeon/Recovery/SkillDialog",
  component: BranchSkillPanel,
  parameters: { design: { host: { width: 512 } } },
  args: { frame: dungeonFrame({ panel: "actor" }).branch, send: () => false },
} satisfies Meta<typeof BranchSkillPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Actor: Story = {};
export const ActorEmpty: Story = { args: { frame: dungeonFrame({ panel: "actor", empty: "actors" }).branch } };
export const Skill: Story = { args: { frame: dungeonFrame({ panel: "skill" }).branch } };
export const SkillEmpty: Story = { args: { frame: dungeonFrame({ panel: "skill", empty: "skills" }).branch } };
export const Target: Story = { args: { frame: dungeonFrame({ panel: "target", injured: true }).branch } };
