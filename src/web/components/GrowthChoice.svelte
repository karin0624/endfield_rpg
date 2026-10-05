<script lang="ts">
import type { GrowthEvent, GrowthFocus } from "../../presentation/growthModel";
import type { GrowthFrame } from "../../presentation/growthProjection";

let { frame, focus, send }: { frame: GrowthFrame; focus: GrowthFocus; send: (event: GrowthEvent) => boolean } =
  $props();
let panel: HTMLElement;
$effect(() => {
  const target = focus;
  const node =
    target?.kind === "heading"
      ? panel.querySelector<HTMLElement>("h1")
      : target?.kind === "candidate"
        ? panel.querySelector<HTMLElement>(`[data-skill-id="${CSS.escape(target.skillId)}"]`)
        : null;
  if (node && node !== document.activeElement) node.focus();
});
function key(event: KeyboardEvent) {
  if (send({ type: "key", key: event.key, shift: event.shiftKey })) {
    event.preventDefault();
    event.stopPropagation();
  }
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Bubbled child keys route the model's focus navigation.) -->
<section class="growth-choice" aria-label="レベルアップのスキル選択" bind:this={panel} onkeydown={key}>
  <h1 tabindex="-1" onfocus={() => send({ type: "focused", target: { kind: "heading" } })}>{frame.title}</h1>
  <p>{frame.summary}</p>
  {#if frame.guaranteed}
    <p>{frame.guaranteed}</p>
  {/if}
  {#if frame.error}
    <p role="alert">{frame.error}</p>
  {/if}
  {#each frame.candidates as candidate (candidate.skillId)}
    <button
      type="button"
      data-skill-id={candidate.skillId}
      onclick={() => send({ type: "choose", skillId: candidate.skillId })}
      onfocus={() => send({ type: "focused", target: { kind: "candidate", skillId: candidate.skillId } })}
    >
      <strong>{candidate.name}</strong><span class="growth-choice-detail">{candidate.detail}</span
      ><span class="growth-choice-detail">{candidate.description}</span>
    </button>
  {/each}
</section>
