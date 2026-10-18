import type { DungeonChromeFrame } from "../../src/presentation/dungeonProjection";

/** Neutral closed recovery controls; stories specify their own panel contents. */
export const branchRecoveryFrame: DungeonChromeFrame["branch"] = {
  skillVisible: true,
  itemVisible: true,
  itemLabel: "物品（HP回復品 ×2）",
  itemAvailable: true,
  panel: null,
  title: "回復する味方を選ぶ",
  buttons: [],
  empty: "分岐で使える回復スキルを習得していません。",
  targets: [
    {
      id: "player",
      label: "ロッシ · HP 20/20",
    },
  ],
  itemTargetId: null,
  itemPreview: "この対象には使用できません。",
  itemUsable: false,
  focus: null,
};
