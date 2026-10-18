import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleEnemyHitbox from "./BattleEnemyHitbox.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-enemyhitbox",
  title: "Components/DS未対応/Battle/EnemyHitbox",
  component: BattleEnemyHitbox,
  parameters: {
    design: {
      host: { padding: 128, width: 180, height: 160 },
      kind: "component",
      component: "Battle/EnemyHitbox",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".enemy-hitbox", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow", scope: "enemy" } })],
  args: { member: battleStoryFrame({}, "hitbox").enemies[0], dispatch },
} satisfies Meta<typeof BattleEnemyHitbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/enemyhitbox/default_pressed-false",
          state: "default_pressed-false",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleOverlay / EnemyHitbox", "state=default"],
          },
        },
        {
          id: "battle/enemyhitbox/pressed_pressed-false",
          state: "pressed_pressed-false",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleOverlay / EnemyHitbox", "state=pressed"],
          },
          interaction: [{ type: "pressed", selector: ".enemy-hitbox" }],
        },
        {
          id: "battle/enemyhitbox/focus_pressed-false",
          state: "focus_pressed-false",
          figma: {
            path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleOverlay / EnemyHitbox", "state=focus"],
          },
          interaction: [{ type: "focus", selector: ".enemy-hitbox" }],
        },
      ],
    },
  },
};
