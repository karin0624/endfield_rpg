import type { Meta, StoryObj } from "@storybook/svelte-vite";
import type { ComponentProps } from "svelte";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import BattleEnemyLabel from "./BattleEnemyLabel.svelte";

const member: ComponentProps<typeof BattleEnemyLabel>["member"] = {
  id: "slime",
  name: "スライム A",
  hp: "30 / 30",
  fraction: 1,
  label: "スライム A、HP 30/30",
  visible: true,
  defeated: false,
  selected: false,
  pressed: false,
  disabled: false,
};

const meta = {
  id: "battle-enemylabel",
  title: "Components/DS未対応/Battle/EnemyLabel",
  component: BattleEnemyLabel,
  parameters: {
    design: {
      host: { padding: 128 },
      kind: "component",
      component: "Battle/EnemyLabel",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".enemy-world-label", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow", scope: "enemy" } })],
  args: { member: member },
} satisfies Meta<typeof BattleEnemyLabel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/enemylabel/selected-false_full_wrap-false",
          state: "selected-false_full_wrap-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleOverlay / EnemyLabel",
              "selected=false, defeated=false",
            ],
          },
        },
      ],
    },
  },
};
export const Selected: Story = {
  args: { member: { ...member, selected: true } },

  parameters: {
    design: {
      targets: [
        {
          id: "battle/enemylabel/selected-true_full_wrap-false",
          state: "selected-true_full_wrap-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleOverlay / EnemyLabel",
              "selected=true, defeated=false",
            ],
          },
        },
      ],
    },
  },
};
export const Defeated: Story = {
  args: { member: { ...member, hp: "0 / 30", fraction: 0, defeated: true, label: "スライム A、HP 0/30、戦闘不能" } },

  parameters: {
    design: {
      targets: [
        {
          id: "battle/enemylabel/selected-false_zero_wrap-false",
          state: "selected-false_zero_wrap-false",
          figma: {
            path: [
              "Components / DS未対応",
              "Battle UI — DS未対応",
              "BattleOverlay / EnemyLabel",
              "selected=false, defeated=true",
            ],
          },
        },
      ],
    },
  },
};
