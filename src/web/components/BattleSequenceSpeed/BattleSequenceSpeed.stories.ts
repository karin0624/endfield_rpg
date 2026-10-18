import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleSequenceSpeed from "./BattleSequenceSpeed.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-sequencespeed",
  title: "Components/DS未対応/Battle/SequenceSpeed",
  component: BattleSequenceSpeed,
  parameters: {
    design: {
      host: { padding: 128 },
      kind: "component",
      component: "Battle/SequenceSpeed",
      viewport: { width: 1920, height: 1080 },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "sequence" } })],
  args: { speed: 1, dispatch },
} satisfies Meta<typeof BattleSequenceSpeed>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/sequencespeed/1_default",
          state: "1_default",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SequenceSpeed",
              "state=default, menu=closed",
            ],
            properties: { menu: "closed" },
          },
          capture: { selector: "[data-sequence-speed]", padding: 16, background: "transparent" },
        },
        {
          id: "battle/sequencespeed/1_focus",
          state: "1_focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SequenceSpeed",
              "state=focus, menu=closed",
            ],
            properties: { menu: "closed" },
          },
          capture: { selector: "[data-sequence-speed]", padding: 16, background: "transparent" },
          interaction: [{ type: "focus", selector: "[data-sequence-speed]" }],
        },
        {
          id: "battle/sequencespeed/1_open-keyboard",
          state: "1_open-keyboard",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SequenceSpeed",
              "state=focus, menu=open",
            ],
            properties: { selectedLabel: "1倍", menu: "open" },
          },
          capture: {
            selector: "[data-sequence-speed]",
            padding: { top: 128, right: 16, bottom: 128, left: 16 },
            background: "transparent",
          },
          interaction: [
            { type: "focus", selector: "[data-sequence-speed]" },
            { type: "key", key: "Alt+ArrowDown", selector: "[data-sequence-speed]" },
          ],
        },
        {
          id: "battle/sequencespeed/1_open-highlight-next",
          state: "1_open-highlight-next",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleHud / SequenceSpeed",
              "state=focus, menu=hover-next",
            ],
            properties: { selectedLabel: "2倍", menu: "hover-next" },
          },
          capture: {
            selector: "[data-sequence-speed]",
            padding: { top: 128, right: 16, bottom: 128, left: 16 },
            background: "transparent",
          },
          interaction: [
            { type: "focus", selector: "[data-sequence-speed]" },
            { type: "key", key: "Alt+ArrowDown", selector: "[data-sequence-speed]" },
            { type: "key", selector: "[data-sequence-speed]", key: "ArrowDown", expectedValue: "1" },
          ],
        },
      ],
    },
  },
};
