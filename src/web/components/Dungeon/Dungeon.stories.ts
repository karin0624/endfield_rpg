import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { branchRecoveryFrame } from "../../../../.storybook/fixtures/dungeon-data";
import { conversationChrome, conversationRoute, dungeonFrame, growthChoice } from "./Dungeon.stories.fixture";
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
  args: { frame: dungeonFrame, battleStatus: null, send: () => false },
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
  args: {
    frame: {
      ...dungeonFrame,
      kind: "conversation",
      route: conversationRoute,
      conversation: {
        ...conversationChrome,
        scene: {
          type: "line",
          speaker: "ロッシ",
          text: "道の脇に、遺跡へ続く新しい足跡が残っている。",
          choices: [],
          portraits: [
            {
              id: "rossi",
              speaking: true,
              position: "left",
              path: "characters/rossi/expressions/neutral.png",
            },
          ],
        },
      },
      status: "現在地: 足跡の調査",
    },
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      kind: "conversation",
      route: conversationRoute,
      conversation: {
        ...conversationChrome,
        scene: {
          type: "choice",
          speaker: "ロッシ",
          text: "足跡を記録する？",
          choices: [
            {
              id: "mark-on-map",
              label: "地図に足跡を記す",
              number: 1,
            },
            {
              id: "continue-without-marking",
              label: "記録せずに先へ進む",
              number: 2,
            },
          ],
          portraits: [
            {
              id: "rossi",
              speaking: true,
              position: "left",
              path: "characters/rossi/expressions/neutral.png",
            },
          ],
        },
      },
      status: "現在地: 足跡の調査",
    },
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      branch: {
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
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      branch: {
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
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      branch: {
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
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      branch: {
        ...branchRecoveryFrame,
        buttons: [],
        empty: "分岐で使える回復スキルを習得していません。",

        panel: "skill",
        title: "ロッシの技を選ぶ",
      },
    },
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      branch: {
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
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      branch: {
        ...branchRecoveryFrame,
        targets: [{ id: "player", label: "ロッシ · HP 20/20" }],
        itemUsable: false,

        panel: "item",
        itemTargetId: "player",
        itemPreview: "HPは満タンです。使用できません。",
      },
    },
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      kind: "outcome",
      outcome: {
        title: "探索を完了しました",
        detail: "遺跡の守り手を倒し、探索を終えました。",
      },
      status: "探索を完了しました",
    },
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      kind: "growth",
      branch: { ...branchRecoveryFrame, targets: [{ id: "player", label: "ロッシ · HP 24/24" }] },
      growth: growthChoice,
    },
  },
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
  args: {
    frame: {
      ...dungeonFrame,
      kind: "growth",
      branch: { ...branchRecoveryFrame, targets: [{ id: "player", label: "ロッシ · HP 24/24" }] },
      growth: { ...growthChoice, guaranteed: "習得済みの成長を確認しました。" },
    },
  },

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
  args: {
    frame: {
      ...dungeonFrame,
      kind: "growth",
      branch: { ...branchRecoveryFrame, targets: [{ id: "player", label: "ロッシ · HP 24/24" }] },
      growth: { ...growthChoice, error: "候補から習得するスキルを選んでください。" },
    },
  },

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
    frame: {
      ...dungeonFrame,
      kind: "growth",
      branch: { ...branchRecoveryFrame, targets: [{ id: "player", label: "ロッシ · HP 24/24" }] },
      growth: {
        ...growthChoice,
        guaranteed: "習得済みの成長を確認しました。",
        error: "候補から習得するスキルを選んでください。",
      },
    },
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
