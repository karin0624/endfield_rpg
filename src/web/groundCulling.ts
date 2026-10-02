import type { BattleEnvironment } from "./battleScene";
import type { BattleSettings } from "./battleSettings";

/** Empirically checked view of this exact GLB, not a general inside/outside geometry test. */
export const groundCullingProfile = {
  ground: "ground/ground1.glb",
  background: "backgrounds/landscape1.png",
  sha256: "0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9",
  cameraX: [-1.1, 0.9],
  cameraY: [6, 7.2],
  fixed: {
    cameraZ: 12.5,
    targetX: 0,
    targetY: 2,
    targetZ: -15,
    fovDegrees: 41.9,
    groundScale: 1,
    backdropScale: 0.67,
    backdropX: 0,
    backdropY: 8.2,
    backdropZ: -8.8,
  },
} as const;

export function hasGroundCullingProfile(environment: BattleEnvironment): boolean {
  return (
    environment.ground === groundCullingProfile.ground && environment.background === groundCullingProfile.background
  );
}

export function canCullGround(
  environment: BattleEnvironment,
  settings: BattleSettings,
  fingerprint: string | undefined,
): boolean {
  const profile = groundCullingProfile;
  return (
    hasGroundCullingProfile(environment) &&
    fingerprint === profile.sha256 &&
    settings.cameraX >= profile.cameraX[0] &&
    settings.cameraX <= profile.cameraX[1] &&
    settings.cameraY >= profile.cameraY[0] &&
    settings.cameraY <= profile.cameraY[1] &&
    Object.entries(profile.fixed).every(([key, value]) => settings[key as keyof typeof profile.fixed] === value)
  );
}
