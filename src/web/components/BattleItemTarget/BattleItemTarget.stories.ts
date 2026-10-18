import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleItemTarget from "./BattleItemTarget.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-itemtarget",
  title: "Components/DS未対応/Battle/ItemTarget",
  component: BattleItemTarget,
  parameters: {
    design: {
      host: { padding: 128, width: 430 },
      kind: "component",
      component: "Battle/ItemTarget",
      viewport: { width: 1920, height: 1080 },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: {
    value: "player",
    options: [
      {
        id: "player",
        text: "ロッシ · HP 10/30",
      },
    ],
    dispatch,
  },
} satisfies Meta<typeof BattleItemTarget>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/itemtarget/player_default",
          state: "player_default",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / ItemTarget",
              "state=default, menu=closed",
            ],
            properties: { menu: "closed" },
          },
          capture: { selector: "[data-item-target]", padding: 16, background: "transparent" },
        },
        {
          id: "battle/itemtarget/player_focus",
          state: "player_focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / ItemTarget",
              "state=focus, menu=closed",
            ],
            properties: { menu: "closed" },
          },
          capture: { selector: "[data-item-target]", padding: 16, background: "transparent" },
          interaction: [{ type: "focus", selector: "[data-item-target]" }],
        },
        {
          id: "battle/itemtarget/player_open-keyboard",
          state: "player_open-keyboard",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / ItemTarget", "state=focus, menu=open"],
            properties: { selectedLabel: "ロッシ · HP 10/30", menu: "open" },
          },
          capture: {
            selector: "[data-item-target]",
            padding: { top: 128, right: 16, bottom: 128, left: 16 },
            background: "transparent",
          },
          interaction: [
            { type: "focus", selector: "[data-item-target]" },
            { type: "key", key: "Alt+ArrowDown", selector: "[data-item-target]" },
          ],
        },
      ],
    },
  },
};
