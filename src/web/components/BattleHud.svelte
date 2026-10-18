<script lang="ts">
import { onMount } from "svelte";
import type { BattleModelEvent } from "../../presentation/battleModel";
import { projectPartyOverflow } from "../../presentation/battlePlacement";
import type { BattleHudFrame } from "../../presentation/battleViewProjection";
import "../items.css";
import BattleAllyCard from "./BattleAllyCard.svelte";
import BattleCommands from "./BattleCommands.svelte";
import BattleResult from "./BattleResult.svelte";
import BattleTimeline from "./BattleTimeline.svelte";

let {
  frame,
  board,
  dispatch,
}: { frame: BattleHudFrame; board: HTMLElement; dispatch: (event: BattleModelEvent) => boolean } = $props();
let ui: HTMLDivElement, party: HTMLElement;
let focus = $derived(frame.focus),
  anchor = $derived(frame.partyAnchor),
  allies = $derived(frame.allies),
  skillBattle = $derived(frame.skillBattle);
$effect(() => {
  if (!focus) return;
  const selector =
    focus.kind === "enemy"
      ? `[data-combatant-id="${CSS.escape(focus.id)}"]`
      : focus.kind === "skill"
        ? `[data-skill-id="${CSS.escape(focus.id)}"]`
        : focus.kind === "symptom"
          ? `[data-ally-id="${CSS.escape(focus.id)}"] [data-symptom="${focus.symptom}"] summary`
          : `[data-focus="${focus.kind}"]`;
  const node = board.querySelector<HTMLElement>(selector);
  if (node && node !== document.activeElement) node.focus();
});
function clearAnchor() {
  party.style.removeProperty("height");
  party.style.removeProperty("align-items");
  for (const card of party.querySelectorAll<HTMLElement>(".ally-card")) card.style.removeProperty("min-height");
}
function applyAnchor() {
  clearAnchor();
  const cards = [...party.querySelectorAll<HTMLElement>(".ally-card")];
  if (anchor) {
    party.style.height = `${anchor.height}px`;
    party.style.alignItems = "flex-start";
    for (const card of cards) card.style.minHeight = `${anchor.height}px`;
  }
  ui.toggleAttribute(
    "data-party-overflow",
    projectPartyOverflow(
      anchor !== null,
      board.getBoundingClientRect().bottom,
      cards.map((card) => card.getBoundingClientRect().bottom),
    ),
  );
}
export function measure() {
  if (!skillBattle) return;
  clearAnchor();
  const style = getComputedStyle(party),
    rect = party.getBoundingClientRect();
  const result = {
    absolute: style.position === "absolute",
    width: rect.width,
    height: rect.height,
    font: style.fontSize,
  };
  applyAnchor();
  return result;
}
$effect(() => {
  anchor;
  allies;
  skillBattle;
  if (skillBattle) applyAnchor();
});
$effect(() => {
  allies;
  skillBattle;
  const observer = new ResizeObserver(() => {
    const result = measure();
    if (result) dispatch({ type: "party-measured", measure: result });
  });
  observer.observe(board);
  for (const details of party.querySelectorAll(".ally-details")) observer.observe(details);
  return () => observer.disconnect();
});
onMount(() => {
  const key = (event: KeyboardEvent) => {
    if (dispatch({ type: "key", key: event.key, shift: event.shiftKey })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  board.addEventListener("keydown", key);
  return () => board.removeEventListener("keydown", key);
});
</script>
<div
  class="battle-ui battle-layout"
  data-battle-ui
  data-skill-battle={frame.skillBattle ? "" : undefined}
  class:with-skills={frame.skillBattle}
  bind:this={ui}
>
  <BattleTimeline queue={frame.queue} />
  <BattleCommands {frame} {dispatch} />
  <section class="party" data-party aria-label="味方の状態" bind:this={party}>
    {#each frame.allies as member (member.id)}
      <BattleAllyCard {member} {dispatch} />
    {/each}
  </section>
  <BattleResult result={frame.result} {dispatch} />
</div>
<p class="sr-only" id="battle-screen-reader-status" data-screen-reader-status role="status" aria-live="polite">
  {frame.announcement}
</p>
