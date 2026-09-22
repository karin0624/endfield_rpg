import { initialBattleCombatants } from "../content/initialBattle";
import type { BattleTeam } from "../game/battle";
import type { BattleSettings } from "./battleSettings";

// 描画専用の配置。ゲーム状態・戦闘ルールには持ち込まない。
export interface FormationPosition {
  readonly x: number;
  readonly z: number;
}

/** 中心を固定した隊列のXZ位置を返す。人数0は空配列として扱う。 */
export function calculateFormationPositions(
  count: number,
  centerX: number,
  centerZ: number,
  stepX: number,
  stepZ: number,
): FormationPosition[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("隊列の人数は0以上の整数で指定してください");
  }
  return Array.from({ length: count }, (_, index) => {
    const offset = index - (count - 1) / 2;
    return {
      x: centerX + offset * stepX,
      z: centerZ + offset * stepZ,
    };
  });
}

export function getFormationPositions(
  settings: BattleSettings,
  team: BattleTeam,
  count: number,
): FormationPosition[] {
  return team === "ally"
    ? calculateFormationPositions(
        count,
        settings.allyCenterX,
        settings.allyCenterZ,
        settings.allyStepX,
        settings.allyStepZ,
      )
    : calculateFormationPositions(
        count,
        settings.enemyCenterX,
        settings.enemyCenterZ,
        settings.enemyStepX,
        settings.enemyStepZ,
      );
}

export interface BattleActorLayout {
  readonly id: string;
  readonly team: BattleTeam;
  readonly image: string;
  readonly pixels: readonly [number, number];
  readonly foot: readonly [number, number];
  readonly height: number;
  readonly flipX: boolean;
  readonly shadow: readonly [number, number];
}

const actorVisuals: Record<string, Omit<BattleActorLayout, "id" | "team">> = {
  player: {
    image: "characters/rossi/front-left.png",
    pixels: [1024, 1536],
    foot: [512, 1508],
    height: 3.3,
    flipX: false,
    shadow: [0.65, 0.28],
  },
  gilberta: {
    image: "characters/gilberta/front-left.png",
    pixels: [1024, 1536],
    foot: [512, 1508],
    height: 3.3,
    flipX: false,
    shadow: [0.65, 0.28],
  },
  slime: {
    image: "enemies/slime-blue.png",
    pixels: [49, 34],
    foot: [24.5, 34],
    height: 1.3,
    flipX: true,
    shadow: [0.8, 0.35],
  },
  "slime-2": {
    image: "enemies/slime-blue.png",
    pixels: [49, 34],
    foot: [24.5, 34],
    height: 1.3,
    flipX: true,
    shadow: [0.8, 0.35],
  },
};

// 通常画面の人数・順序はゲーム側の固定編成から導出し、描画側に重複して持たない。
export const battleLayout = {
  ground: { scale: 26 },
  backdrop: { width: 50, height: (50 * 736) / 2138 },
  actors: initialBattleCombatants.map((combatant) => {
    const visual = actorVisuals[combatant.id];
    if (visual === undefined) {
      throw new Error(`戦闘者の描画素材がありません: ${combatant.id}`);
    }
    return { id: combatant.id, team: combatant.team, ...visual } satisfies BattleActorLayout;
  }),
} as const;
