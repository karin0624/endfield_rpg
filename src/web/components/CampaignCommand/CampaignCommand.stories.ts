import type { Meta, StoryObj } from "@storybook/svelte-vite";
import CampaignCommand from "./CampaignCommand.svelte";

const meta = {
  title: "Legacy/CampaignCommand",
  component: CampaignCommand,
  parameters: {
    design: {
      host: { width: 512 },
      kind: "component",
      component: "legacy/campaign-command",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".campaign-command", padding: 8, background: "#232825" },
    },
  },
  args: { label: "続きから", style: "width:512px" },
} satisfies Meta<typeof CampaignCommand>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: "続きから" },
  parameters: {
    design: {
      targets: [
        {
          id: "legacy/command/false/default",
          state: "primary=false/default",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=false, state=default"],
            properties: { label: "続きから", focusVisible: false },
          },
        },
        {
          id: "legacy/command/false/hover",
          state: "primary=false/hover",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=false, state=hover"],
            properties: { label: "続きから", focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".campaign-command" }],
        },
        {
          id: "legacy/command/false/pressed",
          state: "primary=false/pressed",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=false, state=pressed"],
            properties: { label: "続きから", focusVisible: false },
          },
          interaction: [{ type: "pressed", selector: ".campaign-command" }],
        },
        {
          id: "legacy/command/false/focus",
          state: "primary=false/focus",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=false, state=default"],
            properties: { label: "続きから", focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".campaign-command" }],
        },
        {
          id: "legacy/command/false/focus+hover",
          state: "primary=false/focus+hover",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=false, state=hover"],
            properties: { label: "続きから", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".campaign-command" },
            { type: "hover", selector: ".campaign-command" },
          ],
        },
        {
          id: "legacy/command/false/focus+pressed",
          state: "primary=false/focus+pressed",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=false, state=pressed"],
            properties: { label: "続きから", focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".campaign-command", method: "keyboard" }],
        },
      ],
    },
  },
};
export const Disabled: Story = {
  args: { label: "続きから", disabled: true },
  parameters: {
    design: {
      targets: [
        {
          id: "legacy/command/false/disabled",
          state: "primary=false/disabled",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=false, state=disabled"],
            properties: { label: "続きから", focusVisible: false },
          },
        },
      ],
    },
  },
};
export const Primary: Story = {
  args: { label: "新規開始", primary: true },
  parameters: {
    design: {
      targets: [
        {
          id: "legacy/command/true/default",
          state: "primary=true/default",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=true, state=default"],
            properties: { label: "新規開始", focusVisible: false },
          },
        },
        {
          id: "legacy/command/true/hover",
          state: "primary=true/hover",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=true, state=hover"],
            properties: { label: "新規開始", focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".campaign-command" }],
        },
        {
          id: "legacy/command/true/pressed",
          state: "primary=true/pressed",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=true, state=pressed"],
            properties: { label: "新規開始", focusVisible: false },
          },
          interaction: [{ type: "pressed", selector: ".campaign-command" }],
        },
        {
          id: "legacy/command/true/focus",
          state: "primary=true/focus",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=true, state=default"],
            properties: { label: "新規開始", focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".campaign-command" }],
        },
        {
          id: "legacy/command/true/focus+hover",
          state: "primary=true/focus+hover",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=true, state=hover"],
            properties: { label: "新規開始", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".campaign-command" },
            { type: "hover", selector: ".campaign-command" },
          ],
        },
        {
          id: "legacy/command/true/focus+pressed",
          state: "primary=true/focus+pressed",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=true, state=pressed"],
            properties: { label: "新規開始", focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".campaign-command", method: "keyboard" }],
        },
      ],
    },
  },
};
export const PrimaryDisabled: Story = {
  args: { label: "新規開始", primary: true, disabled: true },
  parameters: {
    design: {
      targets: [
        {
          id: "legacy/command/true/disabled",
          state: "primary=true/disabled",
          figma: {
            path: ["Components / DS未対応", "Campaign", "DS未対応/Campaign/Command", "primary=true, state=disabled"],
            properties: { label: "新規開始", focusVisible: false },
          },
        },
      ],
    },
  },
};
