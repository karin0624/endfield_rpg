import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleCommands from "./BattleCommands.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-commands",
  title: "Components/DS未対応/Battle/Commands",
  component: BattleCommands,
  parameters: {
    design: {
      host: { padding: 128, width: 352 },
      kind: "component",
      component: "Battle/Commands",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".commands", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { frame: battleStoryFrame(), dispatch },
} satisfies Meta<typeof BattleCommands>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/commands/disabled-false",
          state: "disabled-false",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / Commands", "state=default"] },
        },
      ],
    },
  },
};
