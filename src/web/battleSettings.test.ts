import { describe, expect, it } from "vitest";
import savedSettings from "./battle-settings.json";
import { parseBattleSettings } from "./battleSettings";

describe("構図設定の読み込み", () => {
  it("保存形式を読み込み、余分な入力を設定に持ち込まない", () => {
    const settings = parseBattleSettings({ ...savedSettings, unused: "ignored" });
    expect(settings).toEqual(savedSettings);
  });
  it.each([NaN, Infinity, -1, 0, 3, "1", null, undefined])("不正な地面倍率 %s を拒否する", (groundScale) => {
    expect(() => parseBattleSettings({ ...savedSettings, groundScale })).toThrow("地面の倍率");
  });
  it("設定形式の違いとカメラの向きが定まらない配置を拒否する", () => {
    expect(() => parseBattleSettings({ ...savedSettings, version: 3 })).toThrow("形式");
    expect(() => parseBattleSettings({ ...savedSettings, cameraX: 0, targetX: 0, cameraZ: 12, targetZ: 12 })).toThrow(
      "離して",
    );
  });
  it("旧v1は既存値を保ったまま隊列の既定値を移行する", () => {
    const {
      allyCenterX: _allyCenterX,
      allyCenterZ: _allyCenterZ,
      allyStepX: _allyStepX,
      allyStepZ: _allyStepZ,
      enemyCenterX: _enemyCenterX,
      enemyCenterZ: _enemyCenterZ,
      enemyStepX: _enemyStepX,
      enemyStepZ: _enemyStepZ,
      ...legacy
    } = savedSettings;
    const migrated = parseBattleSettings({ ...legacy, version: 1, cameraY: 7 });
    expect(migrated.version).toBe(2);
    expect(migrated.cameraY).toBe(7);
    expect(migrated.allyCenterX).toBe(3.2);
    expect(migrated.enemyStepX).toBe(1.8);
    expect(parseBattleSettings({ ...legacy, version: 1, allyCenterX: 4 }).allyCenterX).toBe(4);
  });
  it("新v2の設定で項目を欠落させた場合は補完せず拒否する", () => {
    const { allyStepX: _allyStepX, ...missing } = savedSettings;
    expect(() => parseBattleSettings(missing)).toThrow("隣への左右差");
    expect(() => parseBattleSettings({ ...savedSettings, allyStepX: 0, allyStepZ: 0 })).toThrow("味方の配置");
    expect(() => parseBattleSettings({ ...savedSettings, enemyStepX: 0, enemyStepZ: 0 })).toThrow("敵の配置");
  });
});
