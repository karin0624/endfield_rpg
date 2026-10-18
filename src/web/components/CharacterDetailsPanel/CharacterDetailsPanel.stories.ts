import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { partyFrame } from "../../../../.storybook/fixtures/party-model";
import CharacterDetailsPanel from "./CharacterDetailsPanel.svelte";

const meta = {
  title: "Party/CharacterDetailsPanel",
  component: CharacterDetailsPanel,
  args: { model: partyFrame({ members: 2 }, "details").details, send: () => false },
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
  args: { model: partyFrame({ members: 2 }, "details").details },
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
  args: { model: partyFrame({ members: 2, symptoms: true }, "details").details },
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
  args: { model: partyFrame({ members: 2, failedPortrait: true }, "details").details },

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
  args: { model: partyFrame({ members: 2, disabled: true }, "details").details },
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
  args: { model: partyFrame({ members: 2, skills: "empty" }, "details").details },
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
