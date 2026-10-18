import type { Meta, StoryObj } from "@storybook/svelte-vite";
import IllustratedAction from "./IllustratedAction.svelte";

const meta = {
  title: "Hub/IllustratedAction",
  component: IllustratedAction,
  args: { id: "design-action", picture: "companions", label: "仲間", onclick: () => {} },
  parameters: {
    design: {
      host: { className: "hub-theme", width: "max-content" },
      kind: "component",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".entry", padding: 8, background: "#192327" },
    },
  },
} satisfies Meta<typeof IllustratedAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Companions: Story = {
  args: { movement: false, picture: "companions", label: "仲間" },
  parameters: {
    design: {
      component: "hub/illustrated-action",
      targets: [
        {
          id: "hub/action/false/default",
          state: "movement=false/default",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=false, state=default"],
            properties: { label: "仲間", focusVisible: false },
          },
        },
        {
          id: "hub/action/false/hover",
          state: "movement=false/hover",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=false, state=hover"],
            properties: { label: "仲間", focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".entry" }],
        },
        {
          id: "hub/action/false/pressed",
          state: "movement=false/pressed",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=false, state=pressed"],
            properties: { label: "仲間", focusVisible: false },
          },
          interaction: [{ type: "pressed", selector: ".entry" }],
        },
        {
          id: "hub/action/false/focus",
          state: "movement=false/focus",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=false, state=default"],
            properties: { label: "仲間", focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".entry" }],
        },
        {
          id: "hub/action/false/focus+hover",
          state: "movement=false/focus+hover",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=false, state=hover"],
            properties: { label: "仲間", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".entry" },
            { type: "hover", selector: ".entry" },
          ],
        },
        {
          id: "hub/action/false/focus+pressed",
          state: "movement=false/focus+pressed",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=false, state=pressed"],
            properties: { label: "仲間", focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".entry", method: "keyboard" }],
        },
      ],
    },
  },
};
export const Travel: Story = {
  args: { movement: true, picture: "map-icon", label: "出かける" },
  parameters: {
    design: {
      component: "hub/illustrated-action",
      targets: [
        {
          id: "hub/action/true/default",
          state: "movement=true/default",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=true, state=default"],
            properties: { label: "出かける", focusVisible: false },
          },
        },
        {
          id: "hub/action/true/hover",
          state: "movement=true/hover",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=true, state=hover"],
            properties: { label: "出かける", focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".entry" }],
        },
        {
          id: "hub/action/true/pressed",
          state: "movement=true/pressed",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=true, state=pressed"],
            properties: { label: "出かける", focusVisible: false },
          },
          interaction: [{ type: "pressed", selector: ".entry" }],
        },
        {
          id: "hub/action/true/focus",
          state: "movement=true/focus",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=true, state=default"],
            properties: { label: "出かける", focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".entry" }],
        },
        {
          id: "hub/action/true/focus+hover",
          state: "movement=true/focus+hover",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=true, state=hover"],
            properties: { label: "出かける", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".entry" },
            { type: "hover", selector: ".entry" },
          ],
        },
        {
          id: "hub/action/true/focus+pressed",
          state: "movement=true/focus+pressed",
          figma: {
            path: ["Components / Hub", "Hub/IllustratedAction", "movement=true, state=pressed"],
            properties: { label: "出かける", focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".entry", method: "keyboard" }],
        },
      ],
    },
  },
};
export const Place: Story = {
  args: { round: true, picture: "tavern", label: "酒場" },
  parameters: {
    design: {
      component: "hub/place-entry",
      targets: [
        {
          id: "hub/place/default",
          state: "default",
          figma: {
            path: ["Components / Hub", "Hub/PlaceEntry (IllustratedAction round)", "state=default, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
        },
        {
          id: "hub/place/hover",
          state: "hover",
          figma: {
            path: ["Components / Hub", "Hub/PlaceEntry (IllustratedAction round)", "state=hover, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
          interaction: [{ type: "hover", selector: ".entry" }],
        },
        {
          id: "hub/place/pressed",
          state: "pressed",
          figma: {
            path: ["Components / Hub", "Hub/PlaceEntry (IllustratedAction round)", "state=pressed, focusVisible=false"],
            properties: { focusVisible: "false" },
          },
          interaction: [{ type: "pressed", selector: ".entry" }],
        },
        {
          id: "hub/place/focus",
          state: "focus",
          figma: {
            path: ["Components / Hub", "Hub/PlaceEntry (IllustratedAction round)", "state=default, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [{ type: "focus", selector: ".entry" }],
        },
        {
          id: "hub/place/focus+hover",
          state: "focus+hover",
          figma: {
            path: ["Components / Hub", "Hub/PlaceEntry (IllustratedAction round)", "state=hover, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [
            { type: "focus", selector: ".entry" },
            { type: "hover", selector: ".entry" },
          ],
        },
        {
          id: "hub/place/focus+pressed",
          state: "focus+pressed",
          figma: {
            path: ["Components / Hub", "Hub/PlaceEntry (IllustratedAction round)", "state=pressed, focusVisible=true"],
            properties: { focusVisible: "true" },
          },
          interaction: [{ type: "pressed", selector: ".entry", method: "keyboard" }],
        },
      ],
    },
  },
};
