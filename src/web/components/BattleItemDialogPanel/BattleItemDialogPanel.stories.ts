import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleItemDialogPanel from "./BattleItemDialogPanel.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemdialog",
  title: "Components/DS未対応/Battle/ItemDialog",
  component: BattleItemDialogPanel,
  parameters: {
    design: {
      host: { padding: 128 },
      kind: "component",
      component: "Battle/ItemDialog",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".item-dialog", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { items: battleStoryFrame({}, "item").items, dispatch },
} satisfies Meta<typeof BattleItemDialogPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/itemdialog/disabled-false_focus-false",
          state: "disabled-false_focus-false",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemDialog", "state=default"] },
        },
      ],
    },
  },
};
