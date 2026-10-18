import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { dungeonFrame } from "../../../../.storybook/fixtures/dungeon-data";
import BranchSkillPanel from "./BranchSkillPanel.svelte";

const meta = {
  id: "dungeon-branch-skill-dialog",
  title: "DS未対応/Dungeon/Recovery/SkillDialog",
  component: BranchSkillPanel,
  parameters: {
    design: {
      host: { width: 512 },
      kind: "component",
      component: "BranchRecovery/SkillDialog",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".branch-skill-dialog", padding: 8, background: "transparent" },
    },
  },
  args: { frame: dungeonFrame({ panel: "actor" }).branch, send: () => false },
} satisfies Meta<typeof BranchSkillPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Actor: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/SkillDialog/actor",
          state: "actor",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillDialog",
              "panel=actor",
            ],
          },
        },
      ],
    },
  },
};
export const ActorEmpty: Story = {
  args: { frame: dungeonFrame({ panel: "actor", empty: "actors" }).branch },
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/SkillDialog/actor-empty",
          state: "actor-empty",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillDialog",
              "panel=actor-empty",
            ],
          },
        },
      ],
    },
  },
};
export const Skill: Story = {
  args: { frame: dungeonFrame({ panel: "skill" }).branch },
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/SkillDialog/skill",
          state: "skill",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillDialog",
              "panel=skill",
            ],
          },
        },
      ],
    },
  },
};
export const SkillEmpty: Story = {
  args: { frame: dungeonFrame({ panel: "skill", empty: "skills" }).branch },
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/SkillDialog/skill-empty",
          state: "skill-empty",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillDialog",
              "panel=skill-empty",
            ],
          },
        },
      ],
    },
  },
};
export const Target: Story = {
  args: { frame: dungeonFrame({ panel: "target", injured: true }).branch },
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/SkillDialog/target",
          state: "target",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillDialog",
              "panel=target",
            ],
          },
        },
      ],
    },
  },
};
