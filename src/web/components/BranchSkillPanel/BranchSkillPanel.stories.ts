import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { branchRecoveryFrame } from "../../../../.storybook/fixtures/dungeon-data";
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
  args: { frame: branchRecoveryFrame, send: () => false },
} satisfies Meta<typeof BranchSkillPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Actor: Story = {
  args: {
    frame: {
      ...branchRecoveryFrame,
      panel: "skill",
      title: "使用者を選ぶ",
      buttons: [
        {
          label: "ロッシ",
          event: {
            type: "actor",
            id: "player",
          },
          focus: {
            kind: "actor",
            id: "player",
          },
          description: "",
        },
      ],
      empty: "回復スキルを使える仲間がいません。",
    },
  },
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
  args: {
    frame: {
      ...branchRecoveryFrame,
      buttons: [],
      panel: "skill",
      title: "使用者を選ぶ",
      empty: "回復スキルを使える仲間がいません。",
      targets: [
        {
          id: "player",
          label: "ロッシ · HP 0/20",
        },
      ],
    },
  },
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
  args: {
    frame: {
      ...branchRecoveryFrame,
      panel: "skill",
      title: "ロッシの技を選ぶ",
      buttons: [
        {
          label: "回復 · 精神疲労 +3",
          event: {
            type: "skill",
            id: "test-heal",
          },
          focus: {
            kind: "skill",
            id: "test-heal",
          },
          description:
            "生存中の味方1体のHPを8＋最大HP×0.5回復。自分も対象。 アクティブ／分岐対応。現在の精神疲労 0。使用前の疲労で回復し、その後に負荷と追加発症を計算します。",
        },
      ],
    },
  },
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
  args: {
    frame: {
      ...branchRecoveryFrame,
      buttons: [],
      empty: "分岐で使える回復スキルを習得していません。",

      panel: "skill",
      title: "ロッシの技を選ぶ",
    },
  },
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
  args: {
    frame: {
      ...branchRecoveryFrame,
      title: "回復する味方を選ぶ",

      panel: "skill",
      buttons: [
        {
          label: "ロッシ HP 12/20",
          event: {
            type: "target",
            id: "player",
          },
          focus: {
            kind: "target",
            id: "player",
          },
          description: "",
        },
      ],
      targets: [
        {
          id: "player",
          label: "ロッシ · HP 12/20",
        },
      ],
    },
  },
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
