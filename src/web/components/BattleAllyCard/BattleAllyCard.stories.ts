import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
import { battleStoryFrame } from "../../../../.storybook/fixtures/battle-data";
import BattleAllyCard from "./BattleAllyCard.svelte";

const dispatch = fn(() => false);
const meta = {
  id: "battle-allycard",
  title: "Components/DS未対応/Battle/AllyCard",
  component: BattleAllyCard,
  parameters: {
    design: {
      host: { padding: 128, width: 337.5 },
      kind: "component",
      component: "Battle/AllyCard",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".ally-card", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { member: battleStoryFrame({ state: "active", hp: "full" }, "ally").allies[0], dispatch },
} satisfies Meta<typeof BattleAllyCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "battle/allycard/active_full_none",
          state: "active_full_none",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / AllyCard", "state=active"] },
        },
      ],
    },
  },
};
export const Waiting: Story = {
  args: { member: battleStoryFrame({ state: "waiting", hp: "full" }, "ally").allies[0] },

  parameters: {
    design: {
      targets: [
        {
          id: "battle/allycard/waiting_full_none",
          state: "waiting_full_none",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / AllyCard", "state=waiting"] },
        },
      ],
    },
  },
};
export const Defeated: Story = {
  args: { member: battleStoryFrame({ state: "defeated", hp: "zero" }, "ally").allies[0] },

  parameters: {
    design: {
      targets: [
        {
          id: "battle/allycard/defeated_zero_none",
          state: "defeated_zero_none",
          figma: { path: ["Components / DS未対応", "Battle UI — DS未対応", "BattleHud / AllyCard", "state=defeated"] },
        },
      ],
    },
  },
};
