import { parseBattleSettings } from "../../src/presentation/battleSettings";
import savedSettings from "../../src/web/battle-settings.json";
import { mountBattleEditor } from "../../src/web/battleEditor";
import type { BattleScene } from "../../src/web/battleScene";
import "../../src/web/style.css";

// Input synchronization, draft storage and export use the real editor. Rendering is tested with real WebGL elsewhere.
const preview: BattleScene = {
  ready: Promise.resolve(),
  applySettings() {},
  previewSettings: () => false,
  getCombatantScreenRect: () => undefined,
  getFrontmostEnemyId: () => undefined,
  getCombatantDepths: () => [],
  refreshCombatantScreenPositions() {},
  paintBattleFrame() {},
  playCombatantEffect() {},
  resetCombatantPresentation() {},
  getGroundingMeasurements: () => [],
  dispose() {},
};
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Editor fixture root missing");
const dispose = mountBattleEditor(app, preview, parseBattleSettings(savedSettings));
window.addEventListener("pagehide", dispose, { once: true });
