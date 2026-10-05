import type { CampaignModel } from "../../src/presentation/campaignModel";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import type { DebugSessionModel } from "../../src/presentation/debugSessionModel";
import { projectDebugSession } from "../../src/presentation/debugSessionProjection";
import {
  type DungeonInput,
  type DungeonModel,
  dungeonAccessibleIds,
  reduceDungeon,
} from "../../src/presentation/dungeonModel";
import { projectDungeon } from "../../src/presentation/dungeonProjection";
import { reduceDungeonRoute } from "../../src/presentation/dungeonRoute";
import { createCampaignView } from "../../src/web/campaignView";
import { createDungeonView } from "../../src/web/dungeonView";
import { requiredElement } from "../../src/web/requiredElement";
import "../../src/web/style.css";
import "../../src/web/debug.css";

// A one-time reference comparison supplies the valid snapshots produced by the headless core.
// Only native measurements/readiness feed back into their display projection; no game inputs run here.
const root = requiredElement<HTMLDivElement>(document, "#app");
let campaign: ReturnType<typeof createCampaignView> | undefined;
let dungeon: ReturnType<typeof createDungeonView> | undefined;
let badge: HTMLElement | undefined;
let paintDungeon: ((state: DungeonModel, input: DungeonInput) => void) | undefined;
function clear() {
  campaign?.dispose();
  dungeon?.dispose();
  campaign = undefined;
  dungeon = undefined;
  badge?.remove();
  badge = undefined;
  paintDungeon = undefined;
}
Object.assign(window, {
  referenceView: {
    campaign(state: CampaignModel) {
      clear();
      campaign = createCampaignView(root, () => false);
      campaign.render(projectCampaign(state));
    },
    debug(state: DebugSessionModel) {
      clear();
      // The real debug entry supplies this native chrome before its view module loads.
      badge = document.createElement("aside");
      badge.className = "debug-mode-badge";
      badge.innerHTML = 'デバッグモード · 通常版とは別の保存スロット <a href="?">タイトルへ</a>';
      document.body.prepend(badge);
      campaign = createCampaignView(root, () => false);
      campaign.render(projectDebugSession(state));
    },
    async dungeon(state: DungeonModel, input: DungeonInput) {
      clear();
      let current = state;
      let measured = input;
      let ready: (() => void) | undefined;
      const complete = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const view = createDungeonView(
        root,
        (event) => {
          const native =
            (event.type === "route" && event.event.type === "measured") ||
            (event.type === "battle" && ["scene-ready", "scene-error", "party-measured"].includes(event.event.type));
          if (!native) return false;
          measured = { ...measured, enemyDepths: view.getEnemyDepths() };
          const changed = reduceDungeon(current, measured, event);
          current = changed.state;
          view.render(projectDungeon(current, measured, "ホームへ帰還"));
          if (event.type === "battle" && event.event.type === "scene-ready") ready?.();
          if (event.type === "battle" && event.event.type === "scene-error") throw new Error(event.event.reason);
          return changed.handled;
        },
        "ホームへ帰還",
      );
      dungeon = view;
      paintDungeon = (next, nextInput) => {
        const routeMeasure = current.route.measure;
        current = next;
        measured = nextInput;
        // The supplied game snapshot has no DOM geometry; retain this same view's real layout measurement.
        if (current.screen.kind === "route" && routeMeasure)
          current = {
            ...current,
            route: reduceDungeonRoute(
              current.route,
              { type: "measured", measure: routeMeasure },
              dungeonAccessibleIds(measured),
            ).state,
          };
        view.render(projectDungeon(current, measured, "ホームへ帰還"));
      };
      const frame = projectDungeon(current, measured, "ホームへ帰還");
      view.render(frame);
      if (current.screen.kind === "battle") {
        view.effect({ type: "open-scene", owner: current.screen.battle.scene.owner }, frame.battle);
        await complete;
      }
    },
    dungeonFrame(state: DungeonModel, input: DungeonInput) {
      paintDungeon?.(state, input);
    },
  },
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) clear();
});
