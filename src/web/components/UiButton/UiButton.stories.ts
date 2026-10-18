import type { Meta, StoryObj } from "@storybook/svelte-vite";
import UiButton from "./UiButton.svelte";

const meta = {
  title: "Legacy/UiButton",
  component: UiButton,
  parameters: {
    design: {
      host: { className: "ui-screen formation-theme", width: "max-content" },
      kind: "component",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".ui-button", padding: 16, background: "transparent" },
    },
  },
} satisfies Meta<typeof UiButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { kind: "default", label: "操作", style: "width:120px;height:44px" },
  parameters: {
    design: {
      component: "shared-ui/button/default",
      targets: [
        {
          id: "shared-ui-default-default",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / default", "state=default"],
          },
          state: "shared-ui-default-default",
        },
        {
          id: "shared-ui-default-hover",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / default", "state=hover"],
          },
          interaction: [{ type: "hover", selector: ".ui-button" }],
          state: "shared-ui-default-hover",
        },
        {
          id: "shared-ui-default-pressed",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / default", "state=pressed"],
          },
          interaction: [{ type: "pressed", selector: ".ui-button" }],
          state: "shared-ui-default-pressed",
        },
        {
          id: "shared-ui-default-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / default", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".ui-button" }],
          state: "shared-ui-default-focus",
        },
        {
          id: "shared-ui-default-hover-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / default", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".ui-button" },
            { type: "hover", selector: ".ui-button" },
          ],
          state: "shared-ui-default-hover-focus",
        },
        {
          id: "shared-ui-default-pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / default", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".ui-button", method: "keyboard" }],
          state: "shared-ui-default-pressed-focus",
        },
      ],
    },
  },
};
export const DefaultDisabled: Story = {
  args: { kind: "default", label: "操作", style: "width:120px;height:44px", disabled: true },

  parameters: {
    design: {
      component: "shared-ui/button/default",
      targets: [
        {
          id: "shared-ui-default-disabled",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / default", "state=disabled"],
          },
          state: "shared-ui-default-disabled",
        },
      ],
    },
  },
};
export const Back: Story = {
  args: { kind: "back", label: "戻る", style: "width:160px;height:48px" },
  parameters: {
    design: {
      component: "shared-ui/button/back",
      targets: [
        {
          id: "shared-ui-back-default",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / back", "state=default"],
          },
          state: "shared-ui-back-default",
        },
        {
          id: "shared-ui-back-hover",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / back", "state=hover"],
          },
          interaction: [{ type: "hover", selector: ".ui-button" }],
          state: "shared-ui-back-hover",
        },
        {
          id: "shared-ui-back-pressed",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / back", "state=pressed"],
          },
          interaction: [{ type: "pressed", selector: ".ui-button" }],
          state: "shared-ui-back-pressed",
        },
        {
          id: "shared-ui-back-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / back", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".ui-button" }],
          state: "shared-ui-back-focus",
        },
        {
          id: "shared-ui-back-hover-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / back", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".ui-button" },
            { type: "hover", selector: ".ui-button" },
          ],
          state: "shared-ui-back-hover-focus",
        },
        {
          id: "shared-ui-back-pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / back", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".ui-button", method: "keyboard" }],
          state: "shared-ui-back-pressed-focus",
        },
      ],
    },
  },
};
export const BackDisabled: Story = {
  args: { kind: "back", label: "戻る", style: "width:160px;height:48px", disabled: true },

  parameters: {
    design: {
      component: "shared-ui/button/back",
      targets: [
        {
          id: "shared-ui-back-disabled",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / back", "state=disabled"],
          },
          state: "shared-ui-back-disabled",
        },
      ],
    },
  },
};
export const Primary: Story = {
  args: { kind: "primary", label: "決定", style: "width:280px;height:64px" },
  parameters: {
    design: {
      component: "shared-ui/button/primary",
      targets: [
        {
          id: "shared-ui-primary-default",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / primary", "state=default"],
          },
          state: "shared-ui-primary-default",
        },
        {
          id: "shared-ui-primary-hover",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / primary", "state=hover"],
          },
          interaction: [{ type: "hover", selector: ".ui-button" }],
          state: "shared-ui-primary-hover",
        },
        {
          id: "shared-ui-primary-pressed",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / primary", "state=pressed"],
          },
          interaction: [{ type: "pressed", selector: ".ui-button" }],
          state: "shared-ui-primary-pressed",
        },
        {
          id: "shared-ui-primary-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / primary", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".ui-button" }],
          state: "shared-ui-primary-focus",
        },
        {
          id: "shared-ui-primary-hover-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / primary", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".ui-button" },
            { type: "hover", selector: ".ui-button" },
          ],
          state: "shared-ui-primary-hover-focus",
        },
        {
          id: "shared-ui-primary-pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / primary", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".ui-button", method: "keyboard" }],
          state: "shared-ui-primary-pressed-focus",
        },
      ],
    },
  },
};
export const PrimaryDisabled: Story = {
  args: { kind: "primary", label: "決定", style: "width:280px;height:64px", disabled: true },

  parameters: {
    design: {
      component: "shared-ui/button/primary",
      targets: [
        {
          id: "shared-ui-primary-disabled",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "UI Button / primary", "state=disabled"],
          },
          state: "shared-ui-primary-disabled",
        },
      ],
    },
  },
};
export const DetailsBack: Story = {
  args: { kind: "back", label: "編成へ戻る", "data-details-back": true },
  parameters: {
    design: {
      component: "character-details/back",
      targets: [
        {
          id: "character-details-back-default",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "CharacterDetails back", "state=default"],
          },
          state: "character-details-back-default",
        },
        {
          id: "character-details-back-hover",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "CharacterDetails back", "state=hover"],
          },
          interaction: [{ type: "hover", selector: ".ui-button" }],
          state: "character-details-back-hover",
        },
        {
          id: "character-details-back-pressed",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "CharacterDetails back", "state=pressed"],
          },
          interaction: [{ type: "pressed", selector: ".ui-button" }],
          state: "character-details-back-pressed",
        },
        {
          id: "character-details-back-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "CharacterDetails back", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".ui-button" }],
          state: "character-details-back-focus",
        },
        {
          id: "character-details-back-hover-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "CharacterDetails back", "state=hover"],
            properties: { focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".ui-button" },
            { type: "hover", selector: ".ui-button" },
          ],
          state: "character-details-back-hover-focus",
        },
        {
          id: "character-details-back-pressed-focus",
          figma: {
            path: ["Components / DS未対応", "Shared UI / ui.css — DS未対応", "CharacterDetails back", "state=pressed"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "pressed", selector: ".ui-button", method: "keyboard" }],
          state: "character-details-back-pressed-focus",
        },
      ],
    },
  },
};
