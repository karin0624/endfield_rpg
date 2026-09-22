import type { BattleCombatantDefinition } from "../game/battle";

/** 敵ターンと勝敗までを確認するための固定2対2戦闘データ。 */
export const initialBattleCombatants = [
  {
    id: "player",
    team: "ally",
    speed: 100,
    hp: 20,
    attackPower: 8,
  },
  {
    id: "gilberta",
    team: "ally",
    speed: 90,
    hp: 18,
    attackPower: 6,
  },
  {
    id: "slime",
    team: "enemy",
    speed: 80,
    hp: 14,
    attackPower: 4,
  },
  {
    id: "slime-2",
    team: "enemy",
    speed: 70,
    hp: 14,
    attackPower: 3,
  },
] as const satisfies readonly BattleCombatantDefinition[];
