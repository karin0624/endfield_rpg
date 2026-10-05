import { projectSequencePositions } from "../presentation/battleGeometry";
import type { BattleViewFrame } from "../presentation/battleViewProjection";
import type { BattleScene } from "./battleScene";
import { requiredElement } from "./requiredElement";
import "./battleSequence.css";

type SequenceFrame = BattleViewFrame["sequence"];

/** Only paints an explicit cue. Its timing and meaning belong to the playback model. */
export function createBattleSequenceView(
  stage: HTMLElement,
  scene: Pick<BattleScene, "refreshCombatantScreenPositions" | "getCombatantScreenRect">,
) {
  const layer = document.createElement("div");
  layer.className = "battle-sequence";
  layer.hidden = true;
  layer.innerHTML =
    '<span class="sequence-actor"></span><span class="sequence-impact" aria-hidden="true"><svg viewBox="0 0 100 100"><path class="impact-rays" d="M50 4 54 38 80 20 62 46 96 50 62 54 80 80 54 62 50 96 46 62 20 80 38 54 4 50 38 46 20 20 46 38Z"/><g class="recovery-rings"><circle cx="50" cy="50" r="32"/><path d="M50 30v40M30 50h40"/></g></svg></span><span class="sequence-number"></span>';
  for (const phase of ["actor", "impact", "settle"]) layer.style.setProperty(`--sequence-${phase}-speed`, "1");
  stage.append(layer);
  const actor = requiredElement<HTMLElement>(layer, ".sequence-actor");
  const impact = requiredElement<HTMLElement>(layer, ".sequence-impact");
  const number = requiredElement<HTMLElement>(layer, ".sequence-number");
  let painted: SequenceFrame | undefined;
  function position() {
    if (!painted) return;
    scene.refreshCombatantScreenPositions();
    const frame = projectSequencePositions({
      stage: { width: stage.clientWidth, height: stage.clientHeight },
      actor: { width: actor.offsetWidth, height: actor.offsetHeight },
      impact: { width: impact.offsetWidth, height: impact.offsetHeight },
      number: { width: number.offsetWidth, height: number.offsetHeight },
      actorRect: painted.actorId ? scene.getCombatantScreenRect(painted.actorId) : undefined,
      targetRect: painted.targetId ? scene.getCombatantScreenRect(painted.targetId) : undefined,
    });
    for (const [element, point] of [
      [actor, frame.actor],
      [impact, frame.impact],
      [number, frame.number],
    ] as const) {
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
    }
  }
  const observer = new ResizeObserver(position);
  observer.observe(stage);
  return {
    paint(frame: SequenceFrame) {
      const measureChanged =
        !painted ||
        painted.actorId !== frame.actorId ||
        painted.targetId !== frame.targetId ||
        painted.label !== frame.label ||
        painted.result !== frame.result ||
        painted.phase !== frame.phase;
      const contentChanged = !painted || painted.label !== frame.label || painted.result !== frame.result;
      const phaseChanged =
        !painted ||
        painted.phase !== frame.phase ||
        painted.motion !== frame.motion ||
        painted.kind !== frame.kind ||
        painted.visible !== frame.visible;
      painted = frame;
      if (phaseChanged) {
        layer.hidden = !frame.visible;
        layer.dataset.phase = frame.phase ?? "";
        layer.dataset.motion = String(frame.motion);
        layer.dataset.kind = frame.kind;
      }
      if (contentChanged) {
        actor.textContent = frame.label;
        number.textContent = frame.result;
      }
      if (measureChanged) position();
      for (const [element, time] of [
        [actor, frame.actorTimeMs],
        [impact, frame.impactTimeMs],
        [number, frame.numberTimeMs],
      ] as const)
        for (const animation of element.getAnimations()) {
          animation.pause();
          animation.currentTime = time;
        }
    },
    async settled() {
      await Promise.all(layer.getAnimations({ subtree: true }).map((animation) => animation.ready));
    },
    dispose() {
      observer.disconnect();
      layer.remove();
    },
  };
}
