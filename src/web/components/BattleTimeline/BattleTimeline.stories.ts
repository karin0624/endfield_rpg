import type { Meta, StoryObj } from "@storybook/svelte-vite";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleTimeline from "./BattleTimeline.svelte";

const meta = {
  id: "battle-timeline",
  title: "Components/DS未対応/Battle/Timeline",
  component: BattleTimeline,
  parameters: {
    design: {
      host: { padding: 128, width: 288 },
      kind: "component",
      component: "Battle/Timeline",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".timeline", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { queue: battleStoryFrame({}, "queue").queue },
} satisfies Meta<typeof BattleTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/timeline/current-false_enemy-false",
          state: "current-false_enemy-false",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Timeline", "state=default"] },
        },
      ],
    },
  },
};
