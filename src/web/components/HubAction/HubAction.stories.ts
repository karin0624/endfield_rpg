import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubAction from "./HubAction.svelte";

const meta = {
  title: "Hub/Action",
  component: HubAction,
  parameters: {
    design: {
      host: { className: "hub-theme", width: "max-content" },
      kind: "component",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".ui-action", padding: 8, background: "#192327" },
    },
  },
} satisfies Meta<typeof HubAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Menu: Story = {
  args: { icon: "menu" },
  parameters: {
    design: {
      component: "hub/menu-button",
      targets: [
        {
          id: "hub/menu-button/default",
          state: "default",
          figma: {
            path: ["Components / Hub", "Hub/HubScene/menu", "state=default, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
        },
        {
          id: "hub/menu-button/hover",
          state: "hover",
          figma: {
            path: ["Components / Hub", "Hub/HubScene/menu", "state=hover, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
          interaction: [{ type: "hover", selector: ".ui-action" }],
        },
        {
          id: "hub/menu-button/pressed",
          state: "pressed",
          figma: {
            path: ["Components / Hub", "Hub/HubScene/menu", "state=pressed, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action" }],
        },
        {
          id: "hub/menu-button/focus",
          state: "focus",
          figma: {
            path: ["Components / Hub", "Hub/HubScene/menu", "state=default, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [{ type: "focus", selector: ".ui-action" }],
        },
        {
          id: "hub/menu-button/focus+hover",
          state: "focus+hover",
          figma: {
            path: ["Components / Hub", "Hub/HubScene/menu", "state=hover, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [
            { type: "focus", selector: ".ui-action" },
            { type: "hover", selector: ".ui-action" },
          ],
        },
        {
          id: "hub/menu-button/focus+pressed",
          state: "focus+pressed",
          figma: {
            path: ["Components / Hub", "Hub/HubScene/menu", "state=pressed, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action", method: "keyboard" }],
        },
      ],
    },
  },
};
export const Close: Story = {
  args: { icon: "close", "aria-label": "閉じる" },
  parameters: {
    design: {
      component: "hub/close-button",
      targets: [
        {
          id: "hub/close/default",
          state: "default",
          figma: {
            path: ["Components / Hub", "Hub/IconButton/Close", "state=default, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
        },
        {
          id: "hub/close/hover",
          state: "hover",
          figma: {
            path: ["Components / Hub", "Hub/IconButton/Close", "state=hover, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
          interaction: [{ type: "hover", selector: ".ui-action" }],
        },
        {
          id: "hub/close/pressed",
          state: "pressed",
          figma: {
            path: ["Components / Hub", "Hub/IconButton/Close", "state=pressed, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action" }],
        },
        {
          id: "hub/close/focus",
          state: "focus",
          figma: {
            path: ["Components / Hub", "Hub/IconButton/Close", "state=default, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [{ type: "focus", selector: ".ui-action" }],
        },
        {
          id: "hub/close/focus+hover",
          state: "focus+hover",
          figma: {
            path: ["Components / Hub", "Hub/IconButton/Close", "state=hover, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [
            { type: "focus", selector: ".ui-action" },
            { type: "hover", selector: ".ui-action" },
          ],
        },
        {
          id: "hub/close/focus+pressed",
          state: "focus+pressed",
          figma: {
            path: ["Components / Hub", "Hub/IconButton/Close", "state=pressed, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action", method: "keyboard" }],
        },
      ],
    },
  },
};
export const Default: Story = {
  args: { label: "取り消す", style: "width:212px" },
  parameters: {
    design: {
      component: "hub/button",
      targets: [
        {
          id: "hub/button/false/default",
          state: "primary=false/default",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=false, state=default, focusVisible=false"],
            properties: { label: "取り消す", focusVisible: "false" },
          },
        },
        {
          id: "hub/button/false/hover",
          state: "primary=false/hover",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=false, state=hover, focusVisible=false"],
            properties: { label: "取り消す", focusVisible: "false" },
          },
          interaction: [{ type: "hover", selector: ".ui-action" }],
        },
        {
          id: "hub/button/false/pressed",
          state: "primary=false/pressed",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=false, state=pressed, focusVisible=false"],
            properties: { label: "取り消す", focusVisible: "false" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action" }],
        },
        {
          id: "hub/button/false/focus",
          state: "primary=false/focus",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=false, state=default, focusVisible=true"],
            properties: { label: "取り消す", focusVisible: "true" },
          },
          interaction: [{ type: "focus", selector: ".ui-action" }],
        },
        {
          id: "hub/button/false/focus+hover",
          state: "primary=false/focus+hover",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=false, state=hover, focusVisible=true"],
            properties: { label: "取り消す", focusVisible: "true" },
          },
          interaction: [
            { type: "focus", selector: ".ui-action" },
            { type: "hover", selector: ".ui-action" },
          ],
        },
        {
          id: "hub/button/false/focus+pressed",
          state: "primary=false/focus+pressed",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=false, state=pressed, focusVisible=true"],
            properties: { label: "取り消す", focusVisible: "true" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action", method: "keyboard" }],
        },
      ],
    },
  },
};
export const Disabled: Story = {
  args: { label: "取り消す", style: "width:212px", disabled: true },
  parameters: {
    design: {
      component: "hub/button",
      targets: [
        {
          id: "hub/button/false/disabled",
          state: "primary=false/disabled",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=false, state=disabled, focusVisible=false"],
            properties: { label: "取り消す", focusVisible: "false" },
          },
        },
      ],
    },
  },
};
export const Primary: Story = {
  args: { label: "保存", primary: true, style: "width:212px" },
  parameters: {
    design: {
      component: "hub/button",
      targets: [
        {
          id: "hub/button/true/default",
          state: "primary=true/default",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=true, state=default, focusVisible=false"],
            properties: { label: "保存", focusVisible: "false" },
          },
        },
        {
          id: "hub/button/true/hover",
          state: "primary=true/hover",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=true, state=hover, focusVisible=false"],
            properties: { label: "保存", focusVisible: "false" },
          },
          interaction: [{ type: "hover", selector: ".ui-action" }],
        },
        {
          id: "hub/button/true/pressed",
          state: "primary=true/pressed",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=true, state=pressed, focusVisible=false"],
            properties: { label: "保存", focusVisible: "false" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action" }],
        },
        {
          id: "hub/button/true/focus",
          state: "primary=true/focus",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=true, state=default, focusVisible=true"],
            properties: { label: "保存", focusVisible: "true" },
          },
          interaction: [{ type: "focus", selector: ".ui-action" }],
        },
        {
          id: "hub/button/true/focus+hover",
          state: "primary=true/focus+hover",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=true, state=hover, focusVisible=true"],
            properties: { label: "保存", focusVisible: "true" },
          },
          interaction: [
            { type: "focus", selector: ".ui-action" },
            { type: "hover", selector: ".ui-action" },
          ],
        },
        {
          id: "hub/button/true/focus+pressed",
          state: "primary=true/focus+pressed",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=true, state=pressed, focusVisible=true"],
            properties: { label: "保存", focusVisible: "true" },
          },
          interaction: [{ type: "pressed", selector: ".ui-action", method: "keyboard" }],
        },
      ],
    },
  },
};
export const PrimaryDisabled: Story = {
  args: { label: "保存", primary: true, style: "width:212px", disabled: true },
  parameters: {
    design: {
      component: "hub/button",
      targets: [
        {
          id: "hub/button/true/disabled",
          state: "primary=true/disabled",
          figma: {
            path: ["Components / Hub", "Hub/Button", "primary=true, state=disabled, focusVisible=false"],
            properties: { label: "保存", focusVisible: "false" },
          },
        },
      ],
    },
  },
};
