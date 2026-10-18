import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import type { ComponentProps } from "svelte";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleSymptom from "./BattleSymptom.svelte";

const symptom: ComponentProps<typeof BattleSymptom>["symptom"] = {
  kind: "mentalFatigue",
  icon: "精",
  label: "精神疲労・軽度",
  detail: "負荷付きスキル効果 × 80%（あと街探索3回）",
  open: false,
};

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
    symptom,
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
  args: { symptom: { ...symptom, open: true } },

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
