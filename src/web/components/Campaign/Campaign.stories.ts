import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { campaignFrame } from "../../../../.storybook/fixtures/hub-model";
import Campaign from "./Campaign.svelte";

const meta = {
  title: "Screens/Campaign",
  component: Campaign,
  args: { send: () => false },
  parameters: { design: { host: { padding: 0 }, kind: "screen", viewport: { width: 1920, height: 1080 } } },
} satisfies Meta<typeof Campaign>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Town: Story = {
  args: { frame: campaignFrame("town") },
  parameters: {
    design: { targets: [{ id: "campaign/screen/town", state: "town", figma: { path: ["Screens", "Town"] } }] },
  },
};
export const Destinations: Story = {
  args: { frame: campaignFrame("destinations") },
  parameters: {
    design: {
      targets: [
        { id: "campaign/screen/destinations", state: "destinations", figma: { path: ["Screens", "Destinations"] } },
      ],
    },
  },
};
export const HomeMenu: Story = {
  args: { frame: campaignFrame("home-menu") },
  parameters: {
    design: {
      targets: [{ id: "campaign/screen/home-menu", state: "home-menu", figma: { path: ["Screens", "Home / menu"] } }],
    },
  },
};
export const HomeTitleOptions: Story = {
  args: { frame: campaignFrame("home-title-options") },
  parameters: {
    design: {
      targets: [
        {
          id: "campaign/screen/home-title-options",
          state: "home-title-options",
          figma: { path: ["Screens", "Home / title-options"] },
        },
      ],
    },
  },
};
export const HomeSaveConfirmation: Story = {
  args: { frame: campaignFrame("home-save-confirmation") },
  parameters: {
    design: {
      targets: [
        {
          id: "campaign/screen/home-save-confirmation",
          state: "home-save-confirmation",
          figma: { path: ["Screens", "Home / save-confirmation"] },
        },
      ],
    },
  },
};
export const HomeSaving: Story = {
  args: { frame: campaignFrame("home-saving") },
  parameters: {
    design: {
      targets: [
        { id: "campaign/screen/home-saving", state: "home-saving", figma: { path: ["Screens", "Home / saving"] } },
      ],
    },
  },
};
export const TownMenu: Story = {
  args: { frame: campaignFrame("town-menu") },
  parameters: {
    design: {
      targets: [{ id: "campaign/screen/town-menu", state: "town-menu", figma: { path: ["Screens", "Town / menu"] } }],
    },
  },
};
export const TownTitleOptions: Story = {
  args: { frame: campaignFrame("town-title-options") },
  parameters: {
    design: {
      targets: [
        {
          id: "campaign/screen/town-title-options",
          state: "town-title-options",
          figma: { path: ["Screens", "Town / title-options"] },
        },
      ],
    },
  },
};
export const TownDiscardConfirmation: Story = {
  args: { frame: campaignFrame("town-discard-confirmation") },
  parameters: {
    design: {
      targets: [
        {
          id: "campaign/screen/town-discard-confirmation",
          state: "town-discard-confirmation",
          figma: { path: ["Screens", "Town / discard-confirmation"] },
        },
      ],
    },
  },
};
export const Home: Story = {
  args: { frame: campaignFrame("home") },
  parameters: {
    design: { targets: [{ id: "campaign/screen/home", state: "home", figma: { path: ["Screens", "Home"] } }] },
  },
};
export const Title: Story = {
  args: { frame: campaignFrame("title") },
  parameters: {
    design: {
      targets: [{ id: "campaign/screen/title", state: "title", figma: { path: ["Screens / DS未対応", "Title"] } }],
    },
  },
};
export const TitleLoading: Story = {
  args: { frame: campaignFrame("title-loading") },
  parameters: {
    design: {
      targets: [
        {
          id: "campaign/screen/title-loading",
          state: "title-loading",
          figma: { path: ["Screens / DS未対応", "Title / loading"] },
        },
      ],
    },
  },
};
export const Introduction: Story = {
  args: { frame: campaignFrame("introduction") },
  parameters: {
    design: {
      targets: [
        {
          id: "campaign/screen/introduction",
          state: "introduction",
          figma: { path: ["Screens / DS未対応", "Introduction"] },
        },
      ],
    },
  },
};
export const NewGameConfirmation: Story = {
  args: { frame: campaignFrame("new-game-confirmation") },
  parameters: {
    design: {
      targets: [
        {
          id: "campaign/screen/new-game-confirmation",
          state: "new-game-confirmation",
          figma: { path: ["Screens / DS未対応", "New game confirmation"] },
        },
      ],
    },
  },
};
