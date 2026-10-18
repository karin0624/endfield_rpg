import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleSequenceSkip from "./BattleSequenceSkip.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-sequenceskip",
  title: "Components/DS未対応/Battle/SequenceSkip",
  component: BattleSequenceSkip,
  parameters: {
    design: {
      host: { padding: 128 },
      kind: "component",
      component: "Battle/SequenceSkip",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-sequence-skip]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "sequence" } })],
  args: { dispatch },
} satisfies Meta<typeof BattleSequenceSkip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/sequenceskip/default",
          state: "default",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SequenceSkip", "state=default"],
          },
        },
        {
          id: "battle/sequenceskip/hover",
          state: "hover",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SequenceSkip", "state=hover"] },
          interaction: [{ type: "hover", selector: "[data-sequence-skip]" }],
        },
        {
          id: "battle/sequenceskip/focus",
          state: "focus",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SequenceSkip", "state=focus"] },
          interaction: [{ type: "focus", selector: "[data-sequence-skip]" }],
        },
        {
          id: "battle/sequenceskip/hover-focus",
          state: "hover-focus",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / SequenceSkip", "state=hover-focus"],
          },
          interaction: [
            { type: "focus", selector: "[data-sequence-skip]" },
            { type: "hover", selector: "[data-sequence-skip]" },
          ],
        },
      ],
    },
  },
};
