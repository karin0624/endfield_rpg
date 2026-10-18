import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleStoryHost from "../../../../.storybook/fixtures/BattleStoryHost.svelte";
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
  args: {
    frame: {
      scene: {
        owner: 0,
        status: "ready",
        reason: "",
      },
      focus: null,
      partyAnchor: null,
      markerId: null,
      skillBattle: true,
      queue: [
        {
          id: "player",
          name: "ロッシ",
          portrait: "characters/rossi/face.png",
          current: false,
          enemy: false,
          ticks: 125,
          label: "ロッシ、次の行動まで 125 tick",
        },
      ],
      allies: [
        {
          id: "player",
          name: "ロッシ",
          portrait: "characters/rossi/face.png",
          hp: "10",
          maximum: 30,
          fraction: 10 / 30,
          active: false,
          defeated: false,
          status: "待機",
          label: "ロッシ、HP 10/30",
          symptoms: [],
        },
      ],
      enemies: [
        {
          id: "slime",
          name: "スライム A",
          hp: "10 / 30",
          fraction: 10 / 30,
          label: "スライム A、HP 10/30",
          visible: true,
          defeated: false,
          selected: false,
          pressed: false,
          disabled: false,
        },
      ],
      attack: {
        visible: true,
        enabled: true,
      },
      skills: {
        triggerVisible: true,
        enabled: true,
        visible: false,
        fatigue: "精神疲労 25（軽度） · 試用値",
        choices: [
          {
            id: "test-heal",
            text: "回復術",
            selected: false,
          },
        ],
        preview: "味方1人のHPを回復します。",
        allyTargetVisible: true,
        allyTargetId: "player",
        allies: [
          {
            id: "player",
            text: "ロッシ · HP 10 / 30",
          },
          {
            id: "gilberta",
            text: "ギルベルタ · HP 30 / 30",
          },
        ],
        useEnabled: true,
      },
      items: {
        visible: true,
        label: "物品（HP回復品 ×3）",
        enabled: true,
        open: false,
        targets: [
          {
            id: "player",
            text: "ロッシ · HP 10/30",
          },
        ],
        targetId: "player",
        preview: "回復見込み +20 HP · 残り3個",
        useEnabled: true,
      },
      controls: {
        visible: true,
        skip: true,
        speed: 1,
      },
      result: {
        visible: false,
        title: "戦闘に勝利しました",
        detail: "敵をすべて倒しました。",
        finishLabel: "再戦する",
        finishAriaLabel: "戦闘を再戦する",
      },
      summary: {
        visible: false,
        text: "HP回復品：ロッシのHPを+20回復 · 精神疲労は変化なし",
      },
      announcement: "選択できる敵がいません。",
      toast: {
        visible: false,
        text: "",
        kind: "",
      },
    },
    dispatch,
  },
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
