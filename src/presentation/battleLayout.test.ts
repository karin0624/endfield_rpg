import { describe, expect, it } from "vitest";

import savedSettings from "../web/battle-settings.json";
import { calculateFormationPositions, getFormationPositions, projectActorPlacements } from "./battleLayout";
import { parseBattleSettings } from "./battleSettings";

describe("隊列の配置計算", () => {
  it("0人は空、1人は中心、2人は中心を保って等間隔に並べる", () => {
    expect(calculateFormationPositions(0, 3, 2, 4, -2)).toEqual([]);
    expect(calculateFormationPositions(1, 3, 2, 4, -2)).toEqual([{ x: 3, z: 2 }]);
    expect(calculateFormationPositions(2, 3, 2, 4, -2)).toEqual([
      { x: 1, z: 3 },
      { x: 5, z: 1 },
    ]);
  });

  it("差分の符号を維持し、敵味方を独立して計算する", () => {
    const settings = parseBattleSettings({
      ...savedSettings,
      allyCenterX: 3,
      allyCenterZ: 2,
      allyStepX: -4,
      allyStepZ: 2,
      enemyCenterX: -2,
      enemyCenterZ: 1,
      enemyStepX: 2,
      enemyStepZ: -2,
    });
    expect(getFormationPositions(settings, "ally", 2)).toEqual([
      { x: 5, z: 1 },
      { x: 1, z: 3 },
    ]);
    expect(getFormationPositions(settings, "enemy", 2)).toEqual([
      { x: -3, z: 2 },
      { x: -1, z: 0 },
    ]);
    expect(getFormationPositions(settings, "ally", 1)).toEqual([{ x: 3, z: 2 }]);
  });

  it("負数・小数の人数を拒否する", () => {
    expect(() => calculateFormationPositions(-1, 0, 0, 1, 0)).toThrow();
    expect(() => calculateFormationPositions(1.5, 0, 0, 1, 0)).toThrow();
  });

  it("通常は全員を配置し、1対1プレビューでも保存判定は全編成の接地点を検査する", () => {
    const settings = parseBattleSettings({
      ...savedSettings,
      groundScale: 2,
      allyCenterX: 3,
      allyCenterZ: 2,
      allyStepX: -4,
      allyStepZ: 2,
      enemyCenterX: -2,
      enemyCenterZ: 1,
      enemyStepX: 2,
      enemyStepZ: -2,
    });
    const actors = [
      { id: "player", team: "ally" },
      { id: "gilberta", team: "ally" },
      { id: "enemy-a", team: "enemy" },
      { id: "enemy-b", team: "enemy" },
    ] as const;
    expect(projectActorPlacements(actors, settings)).toEqual([
      { id: "player", visible: true, x: 10, z: 2, validationX: 10, validationZ: 2 },
      { id: "gilberta", visible: true, x: 2, z: 6, validationX: 2, validationZ: 6 },
      { id: "enemy-a", visible: true, x: -6, z: 4, validationX: -6, validationZ: 4 },
      { id: "enemy-b", visible: true, x: -2, z: 0, validationX: -2, validationZ: 0 },
    ]);
    expect(projectActorPlacements(actors, settings, { ally: 1, enemy: 1 })).toEqual([
      { id: "player", visible: true, x: 6, z: 4, validationX: 10, validationZ: 2 },
      { id: "gilberta", visible: false, x: 2, z: 6, validationX: 2, validationZ: 6 },
      { id: "enemy-a", visible: true, x: -4, z: 2, validationX: -6, validationZ: 4 },
      { id: "enemy-b", visible: false, x: -2, z: 0, validationX: -2, validationZ: 0 },
    ]);
  });
});
