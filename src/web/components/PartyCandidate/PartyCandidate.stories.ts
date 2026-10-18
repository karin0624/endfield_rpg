import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { partyCandidateMember } from "../../../../.storybook/fixtures/party-model";
import PartyCandidate from "./PartyCandidate.svelte";

const meta = {
  title: "Party/Candidate",
  component: PartyCandidate,
  args: { member: partyCandidateMember(), send: () => false },
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
  args: { member: partyCandidateMember() },
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
  args: { member: partyCandidateMember({ selected: false }) },

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
  args: { member: partyCandidateMember({ symptoms: true }) },

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
  args: { member: partyCandidateMember({ failedPortrait: true }) },

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
