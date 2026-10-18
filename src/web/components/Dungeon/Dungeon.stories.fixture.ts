import { branchRecoveryFrame } from "../../../../.storybook/fixtures/dungeon-data";
import type { DungeonChromeFrame } from "../../../presentation/dungeonProjection";
import type { GrowthFrame } from "../../../presentation/growthProjection";

export const dungeonFrame: DungeonChromeFrame = {
  kind: "route",
  returnLabel: "ホームへ帰還",
  calendar: "1日目 · 昼",
  focus: null,
  branchResult: "",
  route: {
    nodes: [
      {
        id: "battle-a",
        type: "battle",
        position: {
          x: 34,
          y: 34,
        },
        title: "戦闘",
        current: false,
        resolved: false,
        enabled: true,
        past: false,
        status: "選択可能",
        label: "戦闘、選択可能",
        icon: "dungeon-nodes/focus/battle.png",
      },
      {
        id: "conversation-b",
        type: "conversation",
        position: {
          x: 34,
          y: 66,
        },
        title: "思わぬ遭遇",
        current: false,
        resolved: false,
        enabled: true,
        past: false,
        status: "選択可能",
        label: "思わぬ遭遇、選択可能",
        icon: "dungeon-nodes/focus/encounter.png",
      },
      {
        id: "boss-c",
        type: "boss",
        position: {
          x: 74,
          y: 50,
        },
        title: "ボス",
        current: false,
        resolved: false,
        enabled: false,
        past: false,
        status: "未到達",
        label: "ボス、未到達",
        icon: "dungeon-nodes/unfocus/boss.png",
      },
    ],
    edges: [
      {
        from: "entrance",
        to: "battle-a",
        appearance: "available",
      },
      {
        from: "entrance",
        to: "conversation-b",
        appearance: "available",
      },
      {
        from: "battle-a",
        to: "boss-c",
        appearance: "unavailable",
      },
      {
        from: "conversation-b",
        to: "boss-c",
        appearance: "unavailable",
      },
    ],
    width: null,
    offset: 0,
    dragging: false,
  },
  conversation: null,
  growth: null,
  growthFocus: null,
  outcome: {
    title: "探索に失敗しました",
    detail: "味方が全員戦闘不能になりました。",
  },
  status: "現在地: 遺跡の入口",

  branch: branchRecoveryFrame,
};

export const conversationRoute: DungeonChromeFrame["route"] = {
  nodes: [
    {
      id: "battle-a",
      type: "battle",
      position: {
        x: 34,
        y: 34,
      },
      title: null,
      current: false,
      resolved: false,
      enabled: false,
      past: true,
      status: "未到達",
      label: "戦闘、未到達",
      icon: "dungeon-nodes/unfocus/battle.png",
    },
    {
      id: "conversation-b",
      type: "conversation",
      position: {
        x: 34,
        y: 66,
      },
      title: "思わぬ遭遇",
      current: true,
      resolved: false,
      enabled: false,
      past: false,
      status: "現在地",
      label: "思わぬ遭遇、現在地",
      icon: "dungeon-nodes/unfocus/encounter.png",
    },
    {
      id: "boss-c",
      type: "boss",
      position: {
        x: 74,
        y: 50,
      },
      title: "ボス",
      current: false,
      resolved: false,
      enabled: false,
      past: false,
      status: "未到達",
      label: "ボス、未到達",
      icon: "dungeon-nodes/unfocus/boss.png",
    },
  ],
  edges: [
    {
      from: "entrance",
      to: "battle-a",
      appearance: "unavailable",
    },
    {
      from: "entrance",
      to: "conversation-b",
      appearance: "unavailable",
    },
    {
      from: "battle-a",
      to: "boss-c",
      appearance: "unavailable",
    },
    {
      from: "conversation-b",
      to: "boss-c",
      appearance: "unavailable",
    },
  ],
  width: null,
  offset: 0,
  dragging: false,
};

export const conversationChrome: Omit<NonNullable<DungeonChromeFrame["conversation"]>, "scene"> = {
  party: undefined,
  mode: "conversation",
  backgroundId: "roadside",
  backgroundPath: "backgrounds/landscape1.png",
  calendar: "",
  feedback: [],
  prompt: "",
  status: "会話中",
  places: [],
  utilities: {
    party: false,
    home: false,
    debug: false,
    editor: false,
  },
  saveStatus: "",
  focus: null,
};

export const growthChoice: GrowthFrame = {
  title: "ロッシ · Lv2 スキル選択",
  summary: "現在Lv2 · 余剰XP 0 · 1つ選ぶと続行します。成長・習得は帰還時に初期化されます。",
  guaranteed: "",
  error: "",
  candidates: [
    {
      skillId: "test-power",
      name: "威力補正",
      description: "攻撃力に2／3／5を加算。攻撃スキルにも反映。",
      detail: "パッシブ 習得 0→1 / 上限3",
    },
    {
      skillId: "test-vitality",
      name: "体力補正",
      description: "最大HPに4／7を加算。回復スキルにも反映。",
      detail: "パッシブ 習得 0→1 / 上限2",
    },
    {
      skillId: "test-light-strike",
      name: "軽撃",
      description: "攻撃力×1.5のダメージ。精神疲労増加なし。",
      detail: "新規アクティブ · 精神疲労 +0 · 戦闘",
    },
  ],
};
