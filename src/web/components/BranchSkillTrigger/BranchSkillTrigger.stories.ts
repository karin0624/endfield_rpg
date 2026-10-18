import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BranchSkillTrigger from "./BranchSkillTrigger.svelte";

const meta = {
  id: "dungeon-branch-skill-trigger",
  title: "DS未対応/Dungeon/Recovery/SkillTrigger",
  component: BranchSkillTrigger,
  parameters: {
    design: {
      host: {},
      kind: "component",
      component: "BranchRecovery/SkillTrigger",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".branch-skill-trigger", padding: 8, background: "transparent" },
    },
  },
  args: {},
} satisfies Meta<typeof BranchSkillTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/SkillTrigger/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/SkillTrigger",
              "state=default",
            ],
            properties: { focusVisible: false },
          },
        },
        {
          id: "BranchRecovery/SkillTrigger/components-page/default",
          state: "default",
          figma: {
            path: ["Components/Dungeon", "Dungeon Nodes", "BranchRecovery/SkillTrigger", "state=default"],
            properties: { focusVisible: false },
          },
        },
        {
          id: "BranchRecovery/SkillTrigger/default+focus",
          state: "default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/SkillTrigger",
              "state=default",
            ],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".branch-skill-trigger" }],
        },
        {
          id: "BranchRecovery/SkillTrigger/components-page/default+focus",
          state: "default+focus",
          figma: {
            path: ["Components/Dungeon", "Dungeon Nodes", "BranchRecovery/SkillTrigger", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".branch-skill-trigger" }],
        },
        {
          id: "BranchRecovery/SkillTrigger/hover",
          state: "hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/SkillTrigger",
              "state=hover",
            ],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".branch-skill-trigger" }],
        },
        {
          id: "BranchRecovery/SkillTrigger/components-page/hover",
          state: "hover",
          figma: {
            path: ["Components/Dungeon", "Dungeon Nodes", "BranchRecovery/SkillTrigger", "state=hover"],
            properties: { focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".branch-skill-trigger" }],
        },
        {
          id: "BranchRecovery/SkillTrigger/hover+focus",
          state: "hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "BranchRecovery/SkillTrigger",
              "state=hover",
            ],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".branch-skill-trigger" },
            { type: "hover", selector: ".branch-skill-trigger" },
          ],
        },
        {
          id: "BranchRecovery/SkillTrigger/components-page/hover+focus",
          state: "hover+focus",
          figma: {
            path: ["Components/Dungeon", "Dungeon Nodes", "BranchRecovery/SkillTrigger", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".branch-skill-trigger" },
            { type: "hover", selector: ".branch-skill-trigger" },
          ],
        },
      ],
    },
  },
};
