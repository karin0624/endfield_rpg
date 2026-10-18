import type { Meta, StoryObj } from "@storybook/svelte-vite";
import type { ComponentProps } from "svelte";
import PartyCandidate from "./PartyCandidate.svelte";

const member = {
  id: "player",
  name: "ロッシ",
  hp: "HP 20/20",
  ratio: 1,
  symptoms: "",
  portrait: "characters/rossi/expressions/neutral.png",
  number: 1,
  unavailable: false,
  reason: "",
  selectionLabel: "隊列 1",
} satisfies ComponentProps<typeof PartyCandidate>["member"];

const meta = {
  title: "Party/Candidate",
  component: PartyCandidate,
  args: { member, send: () => false },
  parameters: {
    design: {
      host: { className: "ui-screen formation-theme", width: "max-content" },
      kind: "component",
      component: "party/candidate",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".party-candidate-card", padding: 16, background: "transparent" },
    },
  },
} satisfies Meta<typeof PartyCandidate>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {
  args: { member: { ...member, number: 1, selectionLabel: "隊列 1" } },
  parameters: {
    design: {
      targets: [
        {
          id: "party-candidate-selected-default",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "Party Candidate",
              "selected=true, hasSymptoms=false, portraitState=available",
            ],
          },
          state: "party-candidate-selected-default",
        },
        {
          id: "party-candidate-selected-focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "Party Candidate",
              "selected=true, hasSymptoms=false, portraitState=available",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: '.party-candidate[value="player"]' }],
          state: "party-candidate-selected-focus",
        },
      ],
    },
  },
};
export const Unselected: Story = {
  args: { member: { ...member, number: 0, selectionLabel: "未選択" } },

  parameters: {
    design: {
      targets: [
        {
          id: "party-candidate-unselected-default",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "Party Candidate",
              "selected=false, hasSymptoms=false, portraitState=available",
            ],
          },
          state: "party-candidate-unselected-default",
        },
        {
          id: "party-candidate-unselected-focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "Party Candidate",
              "selected=false, hasSymptoms=false, portraitState=available",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: '.party-candidate[value="player"]' }],
          state: "party-candidate-unselected-focus",
        },
      ],
    },
  },
};
export const Symptoms: Story = {
  args: {
    member: {
      ...member,
      hp: "HP 13/13",
      symptoms: "肉体疲労・中度　朦朧・重度　精神疲労・軽度",
    },
  },

  parameters: {
    design: {
      targets: [
        {
          id: "party-candidate-selected-symptoms-default",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "Party Candidate",
              "selected=true, hasSymptoms=true, portraitState=available",
            ],
            properties: { hp: "HP 13/13" },
          },
          state: "party-candidate-selected-symptoms-default",
        },
      ],
    },
  },
};
export const PortraitFailed: Story = {
  args: { member: { ...member, portrait: undefined } },

  parameters: {
    design: {
      targets: [
        {
          id: "party-candidate-selected-portrait-failed-default",
          figma: {
            path: [
              "Components / DS未対応",
              "Party — DS未対応",
              "Party Candidate",
              "selected=true, hasSymptoms=false, portraitState=failed",
            ],
          },
          state: "party-candidate-selected-portrait-failed-default",
        },
      ],
    },
  },
};
