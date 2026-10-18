import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchSkillButton from "./BranchSkillButton.svelte";

const meta = {
  id: "dungeon-branch-skill-button",
  title: "DS未対応/Dungeon/Recovery/SkillButton",
  component: BranchSkillButton,
  parameters: {
    design: {
      host: { width: 478 },
      kind: "component",
      component: "BranchRecovery/SkillButton",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".branch-skill-button", padding: 24, background: "transparent" },
    },
  },
  args: { label: "ロッシ", "data-branch-focus": "actor" },
} satisfies Meta<typeof BranchSkillButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/SkillButton/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillButton",
              "state=default",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "BranchRecovery/SkillButton/default+focus",
          state: "default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillButton",
              "state=default",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".branch-skill-button" }],
        },
        {
          id: "BranchRecovery/SkillButton/hover",
          state: "hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillButton",
              "state=hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".branch-skill-button" }],
        },
        {
          id: "BranchRecovery/SkillButton/hover+focus",
          state: "hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/SkillButton",
              "state=hover",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".branch-skill-button" },
            { type: "hover", selector: ".branch-skill-button" },
          ],
        },
      ],
    },
  },
};
