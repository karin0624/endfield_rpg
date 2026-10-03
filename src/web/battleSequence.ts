import type { BattleEvent } from "../game/battle";
import type { BattlePresentation } from "./battlePresentation";
import { requiredElement } from "./requiredElement";
import "./battleSequence.css";

type Action = Extract<BattleEvent, { type: "attack" | "miss" | "skill" }>;

/** Presentation only: callers supply confirmed events, never commands or RNG. */
export function createBattleSequence(stage: HTMLElement, renderer: BattlePresentation) {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const controller = new AbortController();
  const waits = new Map<number, () => void>();
  let disposed = false;
  let speed = 1;
  let defeatId: string | undefined;
  const layer = document.createElement("div");
  layer.className = "battle-sequence";
  layer.hidden = true;
  layer.innerHTML = `<span class="sequence-actor"></span><span class="sequence-impact" aria-hidden="true"><svg viewBox="0 0 100 100"><path class="impact-rays" d="M50 4 54 38 80 20 62 46 96 50 62 54 80 80 54 62 50 96 46 62 20 80 38 54 4 50 38 46 20 20 46 38Z"/><g class="recovery-rings"><circle cx="50" cy="50" r="32"/><path d="M50 30v40M30 50h40"/></g></svg></span><span class="sequence-number"></span>`;
  stage.append(layer);
  const actor = requiredElement<HTMLElement>(layer, ".sequence-actor");
  const impact = requiredElement<HTMLElement>(layer, ".sequence-impact");
  const number = requiredElement<HTMLElement>(layer, ".sequence-number");
  let actorId = "";
  let targetId = "";
  function position() {
    for (const [node, id] of [
      [actor, actorId],
      [impact, targetId],
      [number, targetId],
    ] as const) {
      const rect = renderer.getCombatantScreenRect(id);
      const halfWidth = node.offsetWidth / 2;
      const x = rect?.markerX ?? stage.clientWidth * 0.72;
      node.style.left = `${Math.max(halfWidth + 4, Math.min(stage.clientWidth - halfWidth - 4, x))}px`;
      const y = (rect ? rect.top + rect.height * 0.4 : stage.clientHeight * 0.6) + (node === actor ? 48 : 0);
      const halfHeight = node.offsetHeight / 2;
      node.style.top = `${Math.max(halfHeight + 4, Math.min(stage.clientHeight - halfHeight - 4, y))}px`;
    }
  }
  const observer = new ResizeObserver(position);
  observer.observe(stage);
  function release() {
    for (const [timer, resolve] of waits) {
      clearTimeout(timer);
      resolve();
    }
    waits.clear();
  }
  async function wait(ms: number) {
    if (disposed || speed === 0) return;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        waits.delete(timer);
        resolve();
      }, ms / speed);
      waits.set(timer, resolve);
    });
  }
  function phase(value: string) {
    layer.dataset.phase = value;
    layer.dataset.motion = String(!motion.matches && speed !== 0);
    position();
  }
  motion.addEventListener(
    "change",
    () => {
      layer.dataset.motion = String(!motion.matches && speed !== 0);
      renderer.playCombatantEffect(actorId, "attack", false);
      renderer.playCombatantEffect(targetId, "hit", false);
    },
    { signal: controller.signal },
  );
  return {
    setSpeed(value: number) {
      speed = value;
      layer.style.setProperty("--sequence-speed", String(value || 1));
      if (value === 0) {
        layer.hidden = true;
        if (defeatId) renderer.playCombatantEffect(defeatId, "defeat", false);
        renderer.playCombatantEffect(actorId, "attack", false);
        renderer.playCombatantEffect(targetId, "hit", false);
        release();
      }
    },
    wait,
    async defeat(id: string) {
      if (disposed) return;
      defeatId = id;
      renderer.playCombatantEffect(id, "defeat", !motion.matches && speed !== 0, undefined, 240 / (speed || 1));
      await wait(240);
      if (disposed) return;
      renderer.playCombatantEffect(id, "defeat", false);
      defeatId = undefined;
    },
    async action(event: Action, label: string, result: string, onImpact: () => void) {
      if (disposed) return;
      actorId = event.actorId;
      targetId = event.targetId;
      actor.textContent = label;
      number.textContent = result;
      const hit = event.type !== "miss" && (event.type !== "skill" || event.hit);
      const heal = event.type === "skill" && event.effect === "hp-recovery";
      layer.dataset.kind = !hit ? "miss" : heal ? "heal" : "damage";
      layer.hidden = speed === 0;
      phase("actor");
      await wait(120);
      if (disposed) return;
      phase("prepare");
      renderer.playCombatantEffect(actorId, "attack", !motion.matches && speed !== 0, undefined, 140 / (speed || 1));
      await wait(motion.matches ? 0 : 140);
      if (disposed) return;
      phase("impact");
      onImpact();
      await wait(motion.matches ? 0 : 80);
      if (disposed) return;
      phase("result");
      if (hit && !heal)
        renderer.playCombatantEffect(targetId, "hit", !motion.matches && speed !== 0, undefined, 240 / (speed || 1));
      await wait(380);
      if (disposed) return;
      phase("settle");
      await wait(motion.matches ? 0 : 120);
      layer.hidden = true;
    },
    dispose() {
      disposed = true;
      renderer.playCombatantEffect(actorId, "attack", false);
      renderer.playCombatantEffect(targetId, "hit", false);
      if (defeatId) renderer.playCombatantEffect(defeatId, "defeat", false);
      release();
      observer.disconnect();
      controller.abort();
      layer.remove();
    },
  };
}
