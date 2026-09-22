import type { BattleCombatantDefinition } from "../game/battle";

/** 通常攻撃と勝敗を確認するための最小戦闘データ。 */
export const initialBattleCombatants = [
  {
    id: "player",
    team: "ally",
    speed: 100,
    hp: 20,
    attackPower: 8,
  },
  {
    id: "slime",
    team: "enemy",
    speed: 80,
    hp: 16,
    attackPower: 4,
  },
] as const satisfies readonly BattleCombatantDefinition[];
