import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleSymptom from "../../src/web/components/BattleSymptom.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-symptom",
  title: "Components/DS未対応/Battle/Symptom",
  component: BattleSymptom,
  parameters: { design: { host: { padding: 128, width: 225.3125 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "disclosure" } })],
  args: {
    symptom: battleStoryFrame({ symptom: "mentalFatigue" }, "symptom").allies[0].symptoms[0],
    allyId: "player",
    dispatch,
  },
} satisfies Meta<typeof BattleSymptom>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Open: Story = {
  args: { symptom: battleStoryFrame({ symptom: "mentalFatigue", open: true }, "symptom").allies[0].symptoms[0] },
};
