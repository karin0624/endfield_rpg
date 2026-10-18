import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { dungeonFrame } from "../../../../.storybook/fixtures/dungeon-data";
import DungeonStory from "./Dungeon.stories.svelte";
import Dungeon from "./Dungeon.svelte";

const meta = {
  id: "dungeon-screen",
  title: "Screens/DS未対応/Dungeon",
  component: Dungeon,
  parameters: {
    design: {
      host: { width: 1920, height: 1080, padding: 0 },
      kind: "screen",
      viewport: { width: 1920, height: 1080 },
    },
  },
  args: { frame: dungeonFrame(), battleStatus: null, send: () => false },
  render: (args) => ({ Component: DungeonStory, props: args }),
} satisfies Meta<typeof Dungeon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Route: Story = {
  parameters: {
    design: {
      targets: [
        { id: "screen/Dungeon / route", state: "default", figma: { path: ["Screens / DS未対応", "Dungeon / route"] } },
      ],
    },
  },
};
export const Conversation: Story = {
  args: { frame: dungeonFrame({ mode: "conversation" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / conversation",
          state: "line",
          figma: { path: ["Screens / DS未対応", "Dungeon / conversation"] },
        },
      ],
    },
  },
};
export const ConversationChoice: Story = {
  args: { frame: dungeonFrame({ mode: "conversation", type: "choice" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / conversation choice",
          state: "choice",
          figma: { path: ["Screens / DS未対応", "Dungeon / conversation choice"] },
        },
      ],
    },
  },
};
export const RecoveryActor: Story = {
  args: { frame: dungeonFrame({ panel: "actor" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / recovery actor",
          state: "default",
          figma: {
            path: ["Screens / DS未対応", "Dungeon / recovery actor"],
            interactions: [
              {
                type: "click",
                node: {
                  path: [
                    "Screens / DS未対応",
                    "Dungeon / recovery actor",
                    "Dungeon app",
                    "route-screen",
                    "skill-trigger",
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};
export const RecoveryActorEmpty: Story = {
  args: { frame: dungeonFrame({ panel: "actor", empty: "actors" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / recovery actor-empty",
          state: "default",
          figma: {
            path: ["Screens / DS未対応", "Dungeon / recovery actor-empty"],
            interactions: [
              {
                type: "click",
                node: {
                  path: [
                    "Screens / DS未対応",
                    "Dungeon / recovery actor-empty",
                    "Dungeon app",
                    "route-screen",
                    "skill-trigger",
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};
export const RecoverySkill: Story = {
  args: { frame: dungeonFrame({ panel: "skill" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / recovery skill",
          state: "default",
          figma: {
            path: ["Screens / DS未対応", "Dungeon / recovery skill"],
            interactions: [
              {
                type: "click",
                node: {
                  path: [
                    "Screens / DS未対応",
                    "Dungeon / recovery skill",
                    "Dungeon app",
                    "route-screen",
                    "skill-trigger",
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};
export const RecoverySkillEmpty: Story = {
  args: { frame: dungeonFrame({ panel: "skill", empty: "skills" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / recovery skill-empty",
          state: "default",
          figma: {
            path: ["Screens / DS未対応", "Dungeon / recovery skill-empty"],
            interactions: [
              {
                type: "click",
                node: {
                  path: [
                    "Screens / DS未対応",
                    "Dungeon / recovery skill-empty",
                    "Dungeon app",
                    "route-screen",
                    "skill-trigger",
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};
export const RecoveryTarget: Story = {
  args: { frame: dungeonFrame({ panel: "target", injured: true }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / recovery target",
          state: "default",
          figma: {
            path: ["Screens / DS未対応", "Dungeon / recovery target"],
            interactions: [
              {
                type: "click",
                node: {
                  path: [
                    "Screens / DS未対応",
                    "Dungeon / recovery target",
                    "Dungeon app",
                    "route-screen",
                    "skill-trigger",
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};
export const ItemRecoveryFull: Story = {
  args: { frame: dungeonFrame({ panel: "item" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / item recovery full",
          state: "default",
          figma: {
            path: ["Screens / DS未対応", "Dungeon / item recovery full"],
            interactions: [
              {
                type: "click",
                node: {
                  path: [
                    "Screens / DS未対応",
                    "Dungeon / item recovery full",
                    "Dungeon app",
                    "route-screen",
                    "item-trigger",
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};
export const OutcomeCleared: Story = {
  args: { frame: dungeonFrame({ mode: "outcome", outcome: "cleared" }) },
  parameters: {
    design: {
      targets: [
        {
          id: "screen/Dungeon / outcome cleared",
          state: "cleared",
          figma: { path: ["Screens / DS未対応", "Dungeon / outcome cleared"] },
        },
      ],
    },
  },
};
export const Growth: Story = {
  args: { frame: dungeonFrame({ mode: "growth" }) },
  parameters: {
    design: {
      targets: [
        { id: "screen/GrowthChoice", state: "default", figma: { path: ["Screens / DS未対応", "GrowthChoice"] } },
        {
          id: "screen/GrowthChoice / heading focus",
          state: "heading focus",
          figma: { path: ["Screens / DS未対応", "GrowthChoice / heading focus"] },
          interaction: [{ type: "focus", selector: ".growth-choice h1" }],
        },
      ],
    },
  },
};
export const GrowthGuaranteed: Story = {
  args: { frame: dungeonFrame({ mode: "growth", guaranteed: "習得済みの成長を確認しました。" }) },

  parameters: {
    design: {
      targets: [
        {
          id: "screen/GrowthChoice / guaranteed",
          state: "guaranteed",
          figma: { path: ["Screens / DS未対応", "GrowthChoice / guaranteed"] },
        },
      ],
    },
  },
};
export const GrowthError: Story = {
  args: { frame: dungeonFrame({ mode: "growth", error: "候補から習得するスキルを選んでください。" }) },

  parameters: {
    design: {
      targets: [
        {
          id: "screen/GrowthChoice / error",
          state: "error",
          figma: { path: ["Screens / DS未対応", "GrowthChoice / error"] },
        },
      ],
    },
  },
};
export const GrowthGuaranteedAndError: Story = {
  args: {
    frame: dungeonFrame({
      mode: "growth",
      guaranteed: "習得済みの成長を確認しました。",
      error: "候補から習得するスキルを選んでください。",
    }),
  },

  parameters: {
    design: {
      targets: [
        {
          id: "screen/GrowthChoice / guaranteed and error",
          state: "guaranteed and error",
          figma: { path: ["Screens / DS未対応", "GrowthChoice / guaranteed and error"] },
        },
      ],
    },
  },
};
