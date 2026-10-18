import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { growthFrame } from "../../../../.storybook/fixtures/dungeon-data";
import GrowthCandidate from "./GrowthCandidate.svelte";

const meta = {
  id: "dungeon-growth-candidate",
  title: "DS未対応/Growth/Candidate",
  component: GrowthCandidate,
  parameters: {
    design: {
      host: { width: 656 },
      kind: "component",
      component: "GrowthChoice/Candidate",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".growth-candidate", padding: 24, background: "transparent" },
    },
  },
  args: { candidate: growthFrame().candidates[0], send: () => false },
} satisfies Meta<typeof GrowthCandidate>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "GrowthChoice/Candidate/default",
          state: "default",
          figma: {
            path: ["Components / DS未対応", "Dungeon — DS未対応", "GrowthChoice/Candidate", "state=default"],
            properties: { focusVisible: false },
          },
        },
        {
          id: "GrowthChoice/Candidate/default+focus",
          state: "default+focus",
          figma: {
            path: ["Components / DS未対応", "Dungeon — DS未対応", "GrowthChoice/Candidate", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".growth-candidate" }],
        },
        {
          id: "GrowthChoice/Candidate/hover",
          state: "hover",
          figma: {
            path: ["Components / DS未対応", "Dungeon — DS未対応", "GrowthChoice/Candidate", "state=hover"],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".growth-candidate" }],
        },
        {
          id: "GrowthChoice/Candidate/hover+focus",
          state: "hover+focus",
          figma: {
            path: ["Components / DS未対応", "Dungeon — DS未対応", "GrowthChoice/Candidate", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".growth-candidate" },
            { type: "hover", selector: ".growth-candidate" },
          ],
        },
        {
          id: "GrowthChoice/Candidate/pressed",
          state: "pressed",
          figma: {
            path: ["Components / DS未対応", "Dungeon — DS未対応", "GrowthChoice/Candidate", "state=pressed"],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "pressed", selector: ".growth-candidate" }],
        },
        {
          id: "GrowthChoice/Candidate/pressed+focus",
          state: "pressed+focus",
          figma: {
            path: ["Components / DS未対応", "Dungeon — DS未対応", "GrowthChoice/Candidate", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".growth-candidate" },
            { type: "pressed", method: "keyboard", selector: ".growth-candidate" },
          ],
        },
      ],
    },
  },
};
