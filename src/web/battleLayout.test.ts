import { describe, expect, it } from "vitest";

import savedSettings from "./battle-settings.json";
import { calculateFormationPositions, getFormationPositions } from "./battleLayout";
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
});
