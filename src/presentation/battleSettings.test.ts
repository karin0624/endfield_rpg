import { describe, expect, it } from "vitest";
import savedSettings from "../web/battle-settings.json";
import { parseBattleSettings } from "./battleSettings";

describe("構図設定の読み込み", () => {
  it("保存形式を読み込み、余分な入力を設定に持ち込まない", () => {
    const settings = parseBattleSettings({ ...savedSettings, unused: "ignored" });
    expect(settings).toEqual(savedSettings);
  });
  it("設定形式の違いとカメラの向きが定まらない配置を拒否する", () => {
    expect(() => parseBattleSettings({ ...savedSettings, version: 3 })).toThrow("形式");
    expect(() => parseBattleSettings({ ...savedSettings, cameraX: 0, targetX: 0, cameraZ: 12, targetZ: 12 })).toThrow(
      "離して",
    );
  });
  it("旧v1は補完・変換せず拒否し、入力を変更しない", () => {
    const legacy = { ...savedSettings, version: 1, cameraY: 7 };
    const before = structuredClone(legacy);
    expect(() => parseBattleSettings(legacy)).toThrow("形式");
    expect(legacy).toEqual(before);
    const { allyCenterX: _allyCenterX, ...missing } = legacy;
    expect(() => parseBattleSettings(missing)).toThrow("形式");
  });
  it("新v2の設定で項目を欠落させた場合は補完せず拒否する", () => {
    const { allyStepX: _allyStepX, ...missing } = savedSettings;
    expect(() => parseBattleSettings(missing)).toThrow("隣への左右差");
    expect(() => parseBattleSettings({ ...savedSettings, allyStepX: 0, allyStepZ: 0 })).toThrow("味方の配置");
    expect(() => parseBattleSettings({ ...savedSettings, enemyStepX: 0, enemyStepZ: 0 })).toThrow("敵の配置");
  });
});

// Independent public bounds, deliberately not imported from the editor's field descriptors.
it("all battle setting fields accept both inclusive limits and reject missing, nonfinite and out-of-range input", () => {
  const bounds = {
    cameraX: [-20, 20],
    cameraY: [1, 30],
    cameraZ: [2, 50],
    targetX: [-15, 15],
    targetY: [-5, 15],
    targetZ: [-20, 15],
    fovDegrees: [20, 90],
    groundScale: [0.5, 2.5],
    backdropScale: [0.5, 3],
    backdropX: [-40, 40],
    backdropY: [-15, 40],
    backdropZ: [-60, 10],
    allyCenterX: [-15, 15],
    allyCenterZ: [-20, 15],
    allyStepX: [-10, 10],
    allyStepZ: [-10, 10],
    enemyCenterX: [-15, 15],
    enemyCenterZ: [-20, 15],
    enemyStepX: [-10, 10],
    enemyStepZ: [-10, 10],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    for (const value of [min, max]) {
      expect(parseBattleSettings({ ...savedSettings, [key]: value }), key).toHaveProperty(key, value);
    }
    for (const value of [min - 0.001, max + 0.001, NaN, Infinity, -Infinity, "1", null, undefined]) {
      expect(() => parseBattleSettings({ ...savedSettings, [key]: value }), `${key}=${value}`).toThrow();
    }
  }
  for (const value of [null, [], 1, "settings", undefined, { ...savedSettings, version: "2" }]) {
    expect(() => parseBattleSettings(value)).toThrow();
  }
});

it("camera separation accepts exactly 0.5 and rejects just below in either horizontal direction", () => {
  for (const [cameraX, cameraZ] of [
    [0.5, 12],
    [0, 12.5],
  ]) {
    expect(parseBattleSettings({ ...savedSettings, targetX: 0, targetZ: 12, cameraX, cameraZ })).toMatchObject({
      cameraX,
      cameraZ,
    });
  }
  for (const [cameraX, cameraZ] of [
    [0.499, 12],
    [0, 12.499],
  ]) {
    expect(() => parseBattleSettings({ ...savedSettings, targetX: 0, targetZ: 12, cameraX, cameraZ })).toThrow(
      "離して",
    );
  }
  for (const side of ["ally", "enemy"]) {
    for (const axis of ["X", "Z"]) {
      const value = { ...savedSettings, [`${side}StepX`]: 0, [`${side}StepZ`]: 0, [`${side}Step${axis}`]: 0.001 };
      expect(parseBattleSettings(value)).toMatchObject(value);
    }
  }
});
