<script lang="ts">
import { onMount } from "svelte";
import { projectSequencePositions } from "../../presentation/battleGeometry";
import type { BattleViewFrame } from "../../presentation/battleViewProjection";
import type { BattleScene } from "../battleScene";
import "../battleSequence.css";

let {
  frame,
  stage,
  scene,
}: {
  frame: BattleViewFrame["sequence"];
  stage: HTMLElement;
  scene: Pick<BattleScene, "refreshCombatantScreenPositions" | "getCombatantScreenRect">;
} = $props();
let actor: HTMLSpanElement, impact: HTMLSpanElement, number: HTMLSpanElement;
let actorId = $derived(frame.actorId),
  targetId = $derived(frame.targetId),
  label = $derived(frame.label),
  result = $derived(frame.result),
  phase = $derived(frame.phase);
let visible = $derived(frame.visible),
  motion = $derived(frame.motion),
  kind = $derived(frame.kind),
  actorTime = $derived(frame.actorTimeMs),
  impactTime = $derived(frame.impactTimeMs),
  numberTime = $derived(frame.numberTimeMs);
function position() {
  scene.refreshCombatantScreenPositions();
  const positions = projectSequencePositions({
    stage: { width: stage.clientWidth, height: stage.clientHeight },
    actor: { width: actor.offsetWidth, height: actor.offsetHeight },
    impact: { width: impact.offsetWidth, height: impact.offsetHeight },
    number: { width: number.offsetWidth, height: number.offsetHeight },
    actorRect: actorId ? scene.getCombatantScreenRect(actorId) : undefined,
    targetRect: targetId ? scene.getCombatantScreenRect(targetId) : undefined,
  });
  for (const [node, point] of [
    [actor, positions.actor],
    [impact, positions.impact],
    [number, positions.number],
  ] as const) {
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
  }
}
$effect(() => {
  actorId;
  targetId;
  label;
  result;
  phase;
  position();
});
$effect(() => {
  if (!visible) return;
  phase;
  motion;
  kind;
  for (const [node, time] of [
    [actor, actorTime],
    [impact, impactTime],
    [number, numberTime],
  ] as const)
    for (const animation of node.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
});
onMount(() => {
  const observer = new ResizeObserver(position);
  observer.observe(stage);
  return () => observer.disconnect();
});
</script>
<div
  class="battle-sequence"
  hidden={!frame.visible}
  data-phase={frame.phase ?? ""}
  data-motion={String(frame.motion)}
  data-kind={frame.kind}
  style="--sequence-actor-speed:1;--sequence-impact-speed:1;--sequence-settle-speed:1"
>
  <span class="sequence-actor" bind:this={actor}>{frame.label}</span
  ><span class="sequence-impact" aria-hidden="true" bind:this={impact}
    ><svg aria-hidden="true" viewBox="0 0 100 100">
      <path
        class="impact-rays"
        d="M50 4 54 38 80 20 62 46 96 50 62 54 80 80 54 62 50 96 46 62 20 80 38 54 4 50 38 46 20 20 46 38Z"
      />
      <g class="recovery-rings">
        <circle cx="50" cy="50" r="32" />
        <path d="M50 30v40M30 50h40" />
      </g>
    </svg></span
  ><span class="sequence-number" bind:this={number}>{frame.result}</span>
</div>
