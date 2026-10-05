import { describe, expect, it } from "vitest";
import savedSettings from "../web/battle-settings.json";
import { parseBattleSettings } from "./battleSettings";
import { canCullGround } from "./groundCulling";

const environment = { ground: "ground/ground1.glb", background: "backgrounds/landscape1.png" };
const settings = parseBattleSettings(savedSettings);
const fingerprint = "0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9";

describe("検証済み地形の裏面カリング境界", () => {
  it("既定視点と小移動範囲の四隅を受け入れる", () => {
    expect(canCullGround(environment, settings, fingerprint)).toBe(true);
    for (const [cameraX, cameraY] of [
      [-1.1, 6],
      [-1.1, 7.2],
      [0.9, 6],
      [0.9, 7.2],
    ]) {
      expect(canCullGround(environment, { ...settings, cameraX, cameraY }, fingerprint)).toBe(true);
    }
  });

  it("範囲外や未検証の構図は、高いカメラでも最適化しない", () => {
    for (const change of [
      { cameraX: -1.100001 },
      { cameraX: 0.900001 },
      { cameraY: 5.999999 },
      { cameraY: 7.200001 },
      { cameraY: 20 },
      { cameraZ: 13 },
      { targetX: 0.001 },
      { targetZ: -14.999 },
      { backdropScale: 0.671 },
      { backdropX: 0.001 },
      { backdropY: 8.201 },
      { targetY: 3.5 },
      { fovDegrees: 40 },
      { groundScale: 1.1 },
      { backdropZ: -10 },
    ]) {
      expect(canCullGround(environment, { ...settings, ...change }, fingerprint)).toBe(false);
    }
  });

  it("別環境と、照合できない素材や同じパスの別内容は最適化しない", () => {
    expect(canCullGround({ ...environment, ground: "ground/other.glb" }, settings, fingerprint)).toBe(false);
    expect(canCullGround({ ...environment, background: "backgrounds/dungeon-route.png" }, settings, fingerprint)).toBe(
      false,
    );
    expect(canCullGround(environment, settings, undefined)).toBe(false);
    expect(canCullGround(environment, settings, "unverified-content")).toBe(false);
  });
});
