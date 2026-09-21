import { describe, expect, it } from "vitest";
import savedSettings from "./battle-settings.json";
import { parseBattleSettings } from "./battleSettings";

describe("構図設定の読み込み", () => {
  it("保存形式を往復でき、余分な入力を設定に持ち込まない", () => {
    const settings = parseBattleSettings({ ...savedSettings, unused: "ignored" });
    expect(parseBattleSettings(JSON.parse(JSON.stringify(settings)))).toEqual(savedSettings);
    expect(settings).not.toHaveProperty("unused");
  });
  it.each([NaN, Infinity, -1, 0, 3, "1", null, undefined])("不正な地面倍率 %s を拒否する", groundScale => {
    expect(() => parseBattleSettings({ ...savedSettings, groundScale })).toThrow("地面の倍率");
  });
  it("設定形式の違いとカメラの向きが定まらない配置を拒否する", () => {
    expect(() => parseBattleSettings({ ...savedSettings, version: 2 })).toThrow("形式");
    expect(() => parseBattleSettings({ ...savedSettings, cameraX: 0, targetX: 0, cameraZ: 12, targetZ: 12 })).toThrow("離して");
  });
});
