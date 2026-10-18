import type { Meta, StoryObj } from "@storybook/svelte-vite";
import PartyFooterAction from "./PartyFooterAction.svelte";

const meta = {
  title: "Party/FooterAction",
  component: PartyFooterAction,
  args: { action: "back" },
  parameters: {
    design: {
      host: { className: "ui-screen formation-theme", width: "max-content" },
      kind: "component",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".party-footer-action", padding: 16, background: "transparent" },
    },
  },
} satisfies Meta<typeof PartyFooterAction>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Back: Story = {
  args: { action: "back", "data-party-back": true },
  parameters: {
    design: {
      component: "party/footer/back",
      targets: [
        {
          id: "party-back-default",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / back", "state=default"] },
          state: "party-back-default",
        },
        {
          id: "party-back-hover",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / back", "state=hover"] },
          interaction: [{ type: "hover", selector: ".party-footer-action" }],
          state: "party-back-hover",
        },
        {
          id: "party-back-pressed",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / back", "state=pressed"] },
          interaction: [{ type: "pressed", selector: ".party-footer-action" }],
          state: "party-back-pressed",
        },
        {
          id: "party-back-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / back", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".party-footer-action" }],
          state: "party-back-focus",
        },
        {
          id: "party-back-hover-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / back", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".party-footer-action" },
            { type: "hover", selector: ".party-footer-action" },
          ],
          state: "party-back-hover-focus",
        },
        {
          id: "party-back-pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / back", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".party-footer-action", method: "keyboard" }],
          state: "party-back-pressed-focus",
        },
      ],
    },
  },
};
export const Depart: Story = {
  args: { action: "depart", "data-depart": true },
  parameters: {
    design: {
      component: "party/footer/depart",
      targets: [
        {
          id: "party-depart-default",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / depart", "state=default"] },
          state: "party-depart-default",
        },
        {
          id: "party-depart-hover",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / depart", "state=hover"] },
          interaction: [{ type: "hover", selector: ".party-footer-action" }],
          state: "party-depart-hover",
        },
        {
          id: "party-depart-pressed",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / depart", "state=pressed"] },
          interaction: [{ type: "pressed", selector: ".party-footer-action" }],
          state: "party-depart-pressed",
        },
        {
          id: "party-depart-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / depart", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".party-footer-action" }],
          state: "party-depart-focus",
        },
        {
          id: "party-depart-hover-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / depart", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".party-footer-action" },
            { type: "hover", selector: ".party-footer-action" },
          ],
          state: "party-depart-hover-focus",
        },
        {
          id: "party-depart-pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / depart", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".party-footer-action", method: "keyboard" }],
          state: "party-depart-pressed-focus",
        },
      ],
    },
  },
};
export const DepartDisabled: Story = {
  args: { action: "depart", "data-depart": true, disabled: true },
  parameters: {
    design: {
      component: "party/footer/depart",
      targets: [
        {
          id: "party-depart-disabled",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / depart", "state=disabled"] },
          state: "party-depart-disabled",
        },
      ],
    },
  },
};
export const Confirm: Story = {
  args: { action: "confirm", "data-confirm": true },
  parameters: {
    design: {
      component: "party/footer/confirm",
      targets: [
        {
          id: "party-confirm-default",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / confirm", "state=default"] },
          state: "party-confirm-default",
        },
        {
          id: "party-confirm-hover",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / confirm", "state=hover"] },
          interaction: [{ type: "hover", selector: ".party-footer-action" }],
          state: "party-confirm-hover",
        },
        {
          id: "party-confirm-pressed",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party footer / confirm", "state=pressed"] },
          interaction: [{ type: "pressed", selector: ".party-footer-action" }],
          state: "party-confirm-pressed",
        },
        {
          id: "party-confirm-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / confirm", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".party-footer-action" }],
          state: "party-confirm-focus",
        },
        {
          id: "party-confirm-hover-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / confirm", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".party-footer-action" },
            { type: "hover", selector: ".party-footer-action" },
          ],
          state: "party-confirm-hover-focus",
        },
        {
          id: "party-confirm-pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party footer / confirm", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".party-footer-action", method: "keyboard" }],
          state: "party-confirm-pressed-focus",
        },
      ],
    },
  },
};
