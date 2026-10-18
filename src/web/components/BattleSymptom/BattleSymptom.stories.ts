import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleSymptom from "./BattleSymptom.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-symptom",
  title: "Components/DS未対応/Battle/Symptom",
  component: BattleSymptom,
  parameters: {
    design: {
      host: { padding: 128, width: 225.3125 },
      kind: "component",
      component: "Battle/Symptom",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-symptom=mentalFatigue]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "disclosure" } })],
  args: {
    symptom: battleStoryFrame({ symptom: "mentalFatigue" }, "symptom").allies[0].symptoms[0],
    allyId: "player",
    dispatch,
  },
} satisfies Meta<typeof BattleSymptom>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/symptom/mentalFatigue_open-false_focus-false",
          state: "mentalFatigue_open-false_focus-false",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Symptom", "open=false, focus=false"],
          },
        },
        {
          id: "battle/symptom/mentalFatigue_open-false_focus-true",
          state: "mentalFatigue_open-false_focus-true",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Symptom", "open=false, focus=true"],
          },
          interaction: { type: "focus", selector: "[data-symptom=mentalFatigue] summary" },
        },
      ],
    },
  },
};
export const Open: Story = {
  args: { symptom: battleStoryFrame({ symptom: "mentalFatigue", open: true }, "symptom").allies[0].symptoms[0] },

  parameters: {
    design: {
      targets: [
        {
          id: "battle/symptom/mentalFatigue_open-true_focus-false",
          state: "mentalFatigue_open-true_focus-false",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Symptom", "open=true, focus=false"],
          },
        },
        {
          id: "battle/symptom/mentalFatigue_open-true_focus-true",
          state: "mentalFatigue_open-true_focus-true",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Symptom", "open=true, focus=true"],
          },
          interaction: { type: "focus", selector: "[data-symptom=mentalFatigue] summary" },
        },
      ],
    },
  },
};
