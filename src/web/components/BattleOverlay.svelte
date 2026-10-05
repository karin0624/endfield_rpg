<script lang="ts">
import { onMount } from "svelte";
import { projectTetraFaces } from "../../presentation/battleGeometry";
import type { BattleModelEvent } from "../../presentation/battleModel";
import {
  projectEnemyOverlay,
  projectMobileLabelSeparation,
  projectTargetMarker,
} from "../../presentation/battlePlacement";
import type { BattleHudFrame, BattleMotionFrame } from "../../presentation/battleViewProjection";
import type { BattleScene } from "../battleScene";
import BattleSequence from "./BattleSequence.svelte";

let {
  hud,
  motion,
  stage,
  scene,
  dispatch,
}: {
  hud: BattleHudFrame;
  motion: BattleMotionFrame;
  stage: HTMLElement;
  scene: Pick<BattleScene, "refreshCombatantScreenPositions" | "getCombatantScreenRect">;
  dispatch: (event: BattleModelEvent) => boolean;
} = $props();
let marker: HTMLDivElement;
let markerAngle = $derived(motion.markerAngle);
let faces = $derived(projectTetraFaces(markerAngle ?? 0.1));
let enemies = $derived(hud.enemies),
  markerId = $derived(hud.markerId);
function place() {
  scene.refreshCombatantScreenPositions();
  const labels = new Map<string, HTMLElement>();
  for (const [index, member] of enemies.entries()) {
    const button = stage.querySelector<HTMLButtonElement>(`[data-combatant-id="${CSS.escape(member.id)}"]`),
      label = stage.querySelector<HTMLElement>(`[data-enemy-label="${CSS.escape(member.id)}"]`);
    if (!button || !label) continue;
    labels.set(member.id, label);
    const position = projectEnemyOverlay(
      scene.getCombatantScreenRect(member.id),
      member.visible,
      index,
      stage.clientWidth,
    );
    button.hidden = position === null;
    label.hidden = position === null;
    label.dataset.spriteVisible = String(position !== null);
    if (!position) continue;
    for (const [property, value] of Object.entries({
      left: position.box.left,
      top: position.box.top,
      width: position.box.width,
      height: position.box.height,
    }))
      button.style.setProperty(property, `${value}px`);
    label.style.left = `${position.x}px`;
    label.style.top = `${position.y}px`;
    label.dataset.spriteTop = String(position.box.spriteTop);
  }
  const target = markerId ? labels.get(markerId) : undefined;
  const position = projectTargetMarker(
    markerId ? scene.getCombatantScreenRect(markerId) : undefined,
    {
      visible: target !== undefined && !target.hidden,
      top: Number.parseFloat(target?.style.top ?? "0"),
      height: target?.offsetHeight ?? 0,
    },
    marker.offsetHeight,
  );
  marker.hidden = position === null;
  if (position) {
    marker.style.left = `${position.x}px`;
    marker.style.top = `${position.y}px`;
    const markerRect = marker.getBoundingClientRect();
    for (const [id, label] of labels)
      if (id !== markerId && !label.hidden)
        label.style.top = `${projectMobileLabelSeparation(stage.clientWidth, markerRect, label.getBoundingClientRect(), Number.parseFloat(label.style.top), label.offsetHeight)}px`;
  }
}
$effect(() => {
  enemies;
  markerId;
  place();
  const observer = new ResizeObserver(place);
  observer.observe(stage);
  observer.observe(marker);
  for (const label of stage.querySelectorAll(".enemy-world-label")) observer.observe(label);
  return () => observer.disconnect();
});
onMount(() => {
  place();
});
</script>
<div
  class="target-indicator"
  data-target-indicator
  aria-hidden="true"
  hidden={motion.markerAngle === null}
  bind:this={marker}
>
  <svg aria-hidden="true" class="tetra" viewBox="0 0 64 64" focusable="false">
    <g class="tetra-mesh" data-tetra-mesh>
      {#each faces as face (face.index)}
        <polygon
          points={face.points}
          fill="var(--marker-body)"
          stroke="var(--marker-body)"
          stroke-width="7"
          stroke-linejoin="round"
        />
      {/each}
      {#each faces as face (face.index)}
        <polygon
          points={face.points}
          fill={face.color}
          stroke="var(--marker-edge)"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        {#each face.engraving as path}
          <path d={path} fill="none" stroke="var(--text-secondary)" stroke-width=".85" opacity=".4" />
        {/each}
      {/each}
    </g>
  </svg>
</div>
<div class="event-toast" data-event-toast aria-hidden="true" hidden={!hud.toast.visible} data-event={hud.toast.kind}>
  {hud.toast.text}
</div>
<BattleSequence frame={motion.sequence} {stage} {scene} />
{#each hud.enemies as member (member.id)}
  <!-- biome-ignore lint/a11y/useSemanticElements: A positioned combatant label is a group, not a form fieldset. -->
  <div
    class="enemy-world-label"
    class:defeated={member.defeated}
    class:selected={member.selected}
    data-enemy-label={member.id}
    role="group"
    aria-label={member.label}
  >
    <div class="enemy-world-heading">
      <strong data-enemy-name>{member.name}</strong><span class="enemy-world-hp" data-enemy-hp>{member.hp}</span>
    </div>
    <span class="enemy-world-state" data-enemy-state>{member.defeated ? "戦闘不能" : ""}</span
    ><span class="hp-track enemy-world-track" aria-hidden="true"
      ><span style:width={`${member.fraction * 100}%`}></span></span
    >
  </div>
  <button
    type="button"
    class="enemy-hitbox"
    data-combatant-id={member.id}
    aria-describedby="battle-screen-reader-status"
    disabled={member.disabled}
    aria-pressed={member.pressed}
    aria-label={`${member.label}、攻撃対象に選択`}
    onclick={() => dispatch({ type: "select-enemy", id: member.id })}
    onfocus={() => dispatch({ type: "focused", target: { kind: "enemy", id: member.id } })}
  ></button>
{/each}
