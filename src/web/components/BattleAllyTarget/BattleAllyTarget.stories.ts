import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, userEvent } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleAllyTarget from "./BattleAllyTarget.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-allytarget",
  title: "Components/DS未対応/Battle/AllyTarget",
  component: BattleAllyTarget,
  parameters: {
    design: {
      host: { padding: 128, width: 320.625 },
      kind: "component",
      component: "Battle/AllyTarget",
      viewport: { width: 1920, height: 1080 },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: {
    value: "player",
    options: [
      {
        id: "player",
        text: "ロッシ · HP 10 / 30",
      },
      {
        id: "gilberta",
        text: "ギルベルタ · HP 30 / 30",
      },
    ],
    dispatch,
  },
} satisfies Meta<typeof BattleAllyTarget>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/allytarget/player_default",
          state: "player_default",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / AllyTarget",
              "state=default, menu=closed",
            ],
            properties: { menu: "closed" },
          },
          capture: { selector: "[data-ally-target]", padding: 16, background: "transparent" },
        },
        {
          id: "battle/allytarget/player_focus",
          state: "player_focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / AllyTarget",
              "state=focus, menu=closed",
            ],
            properties: { menu: "closed" },
          },
          capture: { selector: "[data-ally-target]", padding: 16, background: "transparent" },
          interaction: [{ type: "focus", selector: "[data-ally-target]" }],
        },
        {
          id: "battle/allytarget/player_open-keyboard",
          state: "player_open-keyboard",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / AllyTarget", "state=focus, menu=open"],
            properties: { selectedLabel: "ロッシ · HP 10 / 30", menu: "open" },
          },
          capture: {
            selector: "[data-ally-target]",
            padding: { top: 128, right: 16, bottom: 128, left: 16 },
            background: "transparent",
          },
          interaction: [
            { type: "focus", selector: "[data-ally-target]" },
            { type: "key", key: "Alt+ArrowDown", selector: "[data-ally-target]" },
          ],
        },
        {
          id: "battle/allytarget/player_open-highlight-next",
          state: "player_open-highlight-next",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / AllyTarget",
              "state=focus, menu=hover-next",
            ],
            properties: { selectedLabel: "ギルベルタ · HP 30 / 30", menu: "hover-next" },
          },
          capture: {
            selector: "[data-ally-target]",
            padding: { top: 128, right: 16, bottom: 128, left: 16 },
            background: "transparent",
          },
          interaction: [
            { type: "focus", selector: "[data-ally-target]" },
            { type: "key", key: "Alt+ArrowDown", selector: "[data-ally-target]" },
            { type: "key", selector: "[data-ally-target]", key: "ArrowDown", expectedValue: "player" },
          ],
        },
      ],
    },
  },
};

export const ChangeTarget: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.selectOptions(canvas.getByRole("combobox"), "gilberta");
    await expect(args.dispatch).toHaveBeenCalledWith({ type: "select-ally", id: "gilberta" });
  },
};
