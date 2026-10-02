import type { BattleCombatantDefinition } from "../game/battle";
import type { BattleScene } from "./battleScene";
import type { BattleSettings } from "./battleSettings";

/** UI consumes projection and presentation, while battle rules remain in the game core. */
export type BattlePresentation = Pick<
  BattleScene,
  | "getCombatantScreenRect"
  | "getFrontmostEnemyId"
  | "refreshCombatantScreenPositions"
  | "playCombatantEffect"
  | "resetCombatantPresentation"
>;

export interface DungeonBattleRenderer {
  beginBattle(
    combatants: readonly BattleCombatantDefinition[],
  ): BattlePresentation & Pick<BattleScene, "ready" | "dispose">;
  dispose(): void;
}

export type DungeonBattleRendererFactory = (
  canvas: HTMLCanvasElement,
  settings: BattleSettings,
) => DungeonBattleRenderer;
