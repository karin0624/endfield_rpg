import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { dungeonFrame } from "../../../../.storybook/fixtures/dungeon-data";
import BranchItemPanel from "./BranchItemPanel.svelte";

const meta = {
  id: "dungeon-branch-item-dialog",
  title: "DS未対応/Dungeon/Recovery/ItemDialog",
  component: BranchItemPanel,
  parameters: {
    design: {
      host: { width: 480 },
      kind: "component",
      component: "BranchRecovery/ItemDialog",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".item-dialog", padding: 16, background: "transparent" },
    },
  },
  args: { frame: dungeonFrame({ panel: "item" }).branch, send: () => false },
} satisfies Meta<typeof BranchItemPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "BranchRecovery/ItemDialog/full",
          state: "full",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon / BranchRecovery / Local Components — DS未対応",
              "BranchRecovery/ItemDialog",
              "state=default",
            ],
          },
        },
      ],
    },
  },
};
