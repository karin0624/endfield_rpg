import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubDialog from "./HubDialog.svelte";

const meta = {
  title: "Hub/Dialog",
  component: HubDialog,
  args: { panel: "menu", command: () => {} },
  parameters: {
    design: {
      host: { className: "hub-theme", width: "max-content" },
      kind: "component",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".hub-dialog", padding: 8, background: "#192327" },
    },
  },
} satisfies Meta<typeof HubDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MenuHome: Story = {
  args: { panel: "menu", scene: "home" },
  parameters: {
    design: {
      component: "hub/dialog/menu",
      targets: [
        {
          id: "hub/dialog/menu/home/default",
          state: "home/default",
          figma: { path: ["Components / Hub", "Hub/Dialog/Menu", "scene=home"] },
        },
      ],
    },
  },
};
export const MenuTown: Story = {
  args: { panel: "menu", scene: "town" },
  parameters: {
    design: {
      component: "hub/dialog/menu",
      targets: [
        {
          id: "hub/dialog/menu/town/default",
          state: "town/default",
          figma: { path: ["Components / Hub", "Hub/Dialog/Menu", "scene=town"] },
        },
      ],
    },
  },
};
export const TitleHome: Story = {
  args: { panel: "title-options", scene: "home" },
  parameters: {
    design: {
      component: "hub/dialog/title-options",
      targets: [
        {
          id: "hub/dialog/title-options/home",
          state: "home",
          figma: { path: ["Components / Hub", "Hub/Dialog/TitleOptions", "scene=home"] },
        },
      ],
    },
  },
};
export const TitleTown: Story = {
  args: { panel: "title-options", scene: "town" },
  parameters: {
    design: {
      component: "hub/dialog/title-options",
      targets: [
        {
          id: "hub/dialog/title-options/town",
          state: "town",
          figma: { path: ["Components / Hub", "Hub/Dialog/TitleOptions", "scene=town"] },
        },
      ],
    },
  },
};
export const SaveConfirmation: Story = {
  args: { panel: null, confirmation: "save" },
  parameters: {
    design: {
      component: "hub/dialog/confirmation",
      targets: [
        {
          id: "hub/dialog/confirmation/save",
          state: "save",
          figma: { path: ["Components / Hub", "Hub/Dialog/Confirmation", "state=default"] },
        },
      ],
    },
  },
};
