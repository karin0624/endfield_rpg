import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { rossiDetails } from "../../../../.storybook/fixtures/character-details-data";
import type { CharacterDetailsModel } from "../../../presentation/characterDetails";
import CharacterDetailsPanel from "./CharacterDetailsPanel.svelte";

const model: CharacterDetailsModel = {
  active: true,
  dialog: rossiDetails,
  generation: 1,
  focus: null,
  scrollTop: 0,
};

const meta = {
  title: "Party/CharacterDetailsPanel",
  component: CharacterDetailsPanel,
  args: { model, send: () => false },
  parameters: {
    design: {
      host: { className: "ui-screen formation-theme", width: "max-content" },
      kind: "component",
      component: "character-details/dialog",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".character-details", padding: 16, background: "transparent" },
    },
  },
} satisfies Meta<typeof CharacterDetailsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { model },
  parameters: {
    design: {
      targets: [
        {
          id: "character-details-dialog",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "CharacterDetails",
              "hasSymptoms=false, portraitState=available, skillsState=learned, unavailable=false",
            ],
          },
          state: "character-details-dialog",
        },
        {
          id: "character-details-dialog-information-focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "CharacterDetails",
              "hasSymptoms=false, portraitState=available, skillsState=learned, unavailable=false",
            ],
            properties: { informationFocusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".character-details-info" }],
          state: "character-details-dialog-information-focus",
        },
      ],
    },
  },
};
export const Symptoms: Story = {
  args: {
    model: {
      ...model,
      dialog: {
        ...rossiDetails,
        stats: [
          ["HP", "13 / 13", "基礎最大HP 20 · 症状前最大HP 20 · 肉体疲労による低下"],
          ["攻撃力", "8", ""],
          ["速度", "100", ""],
          ["命中率", "80%", "基礎 100% · 朦朧による低下"],
          ["レベル", "1", ""],
          ["精神疲労", "25（軽度）", ""],
          ["肉体疲労", "50（中度）", "上限 200 · 街探索1回につき 10 回復"],
          ["朦朧", "75（重度）", "上限 200 · 街探索1回につき 10 回復"],
        ],
        symptoms: "肉体疲労・中度 · 最大HP × 66.67%（あと街探索5回） / 朦朧・重度 · 命中率 × 80%（あと街探索8回）",
      },
    },
  },
  parameters: {
    design: {
      targets: [
        {
          id: "character-details-dialog-symptoms",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "CharacterDetails",
              "hasSymptoms=true, portraitState=available, skillsState=learned, unavailable=false",
            ],
            properties: {
              "stats.HP.value": "13 / 13",
              "stats.攻撃力.value": "8",
              "stats.速度.value": "100",
              "stats.命中率.value": "80%",
              "stats.レベル.value": "1",
              "stats.精神疲労.value": "25（軽度）",
              "stats.肉体疲労.value": "50（中度）",
              "stats.朦朧.value": "75（重度）",
            },
          },
          state: "character-details-dialog-symptoms",
        },
      ],
    },
  },
};
export const PortraitFailed: Story = {
  args: { model: { ...model, dialog: { ...rossiDetails, portraitFailed: true } } },

  parameters: {
    design: {
      targets: [
        {
          id: "character-details-dialog-portrait-failed",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "CharacterDetails",
              "hasSymptoms=false, portraitState=failed, skillsState=learned, unavailable=false",
            ],
          },
          state: "character-details-dialog-portrait-failed",
        },
      ],
    },
  },
};
export const Unavailable: Story = {
  args: {
    model: {
      ...model,
      dialog: {
        ...rossiDetails,
        stats: [["HP", "0 / 20", ""], ...rossiDetails.stats.slice(1)],
        unavailable: "戦闘に参加できません。街探索で回復を進められます。",
      },
    },
  },
  parameters: {
    design: {
      targets: [
        {
          id: "character-details-dialog-unavailable",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "CharacterDetails",
              "hasSymptoms=false, portraitState=available, skillsState=learned, unavailable=true",
            ],
            properties: {
              "stats.HP.value": "0 / 20",
              "stats.攻撃力.value": "8",
              "stats.速度.value": "100",
              "stats.命中率.value": "100%",
              "stats.レベル.value": "1",
              "stats.精神疲労.value": "0（なし）",
              "stats.肉体疲労.value": "0（なし）",
              "stats.朦朧.value": "0（なし）",
            },
          },
          state: "character-details-dialog-unavailable",
        },
      ],
    },
  },
};
export const EmptySkills: Story = {
  args: { model: { ...model, dialog: { ...rossiDetails, skills: [], emptySkills: "習得スキルなし" } } },
  parameters: {
    design: {
      targets: [
        {
          id: "character-details-dialog-empty-skills",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "CharacterDetails",
              "hasSymptoms=false, portraitState=available, skillsState=empty, unavailable=false",
            ],
          },
          state: "character-details-dialog-empty-skills",
        },
      ],
    },
  },
};
