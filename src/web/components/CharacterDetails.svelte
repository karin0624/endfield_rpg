<script lang="ts">
import { onDestroy } from "svelte";
import type { CharacterDetailsInteraction, CharacterDetailsModel } from "../../presentation/characterDetails";
import Portrait from "./Portrait.svelte";
import "../party.css";

let {
  model,
  send,
  focusOpener,
}: {
  model: CharacterDetailsModel;
  send: (event: CharacterDetailsInteraction) => boolean;
  focusOpener: (characterId: string) => void;
} = $props();
let dialog: HTMLDialogElement, information: HTMLDivElement, body: HTMLDivElement, back: HTMLButtonElement;
let frame = $derived(model.dialog);
const scrollOwner = () => (getComputedStyle(information).overflowY === "visible" ? body : information);
$effect(() => {
  if (frame && !dialog.open) dialog.showModal();
  else if (!frame && dialog.open) dialog.close();
});
$effect(() => {
  if (!frame) return;
  const top = model.scrollTop;
  if (scrollOwner().scrollTop !== top) scrollOwner().scrollTop = top;
});
$effect(() => {
  const target = model.focus;
  if (target?.kind === "back" && document.activeElement !== back) back.focus();
  else if (target?.kind === "information" && document.activeElement !== information) information.focus();
  else if (target?.kind === "opener") focusOpener(target.characterId);
});
function scroll(event: Event) {
  if (event.currentTarget === scrollOwner()) send({ type: "scrolled", scrollTop: scrollOwner().scrollTop });
}
onDestroy(() => {
  if (dialog?.open) dialog.close();
});
</script>

<dialog
  class="character-details ui-dialog"
  aria-labelledby="character-details-name"
  bind:this={dialog}
  oncancel={(event) => {
  event.preventDefault();
  send({ type: "close" });
}}
  onkeydown={(event) => {
  if (send({ type: "key", key: event.key, shift: event.shiftKey })) {
    event.preventDefault();
    event.stopPropagation();
  }
}}
>
  <footer class="ui-actions">
    <button
      type="button"
      class="ui-button ui-back"
      data-details-back
      bind:this={back}
      onclick={() => send({ type: "close" })}
      onfocus={() => send({ type: "focused", target: { kind: "back" } })}
    >
      編成へ戻る
    </button>
  </footer>
  <header class="character-details-heading">
    <h2 class="ui-title" id="character-details-name">{frame?.name ?? ""}</h2>
    <p class="sr-only" id="character-details-scroll-hint">能力・習得はスクロールして確認</p>
  </header>
  <div class="character-details-body" bind:this={body} onscroll={scroll}>
    <div class="character-details-portrait" data-details-portrait hidden={!frame?.portrait}>
      {#if frame}
        {#if frame.portraitFailed}
          画像なし
        {:else}
          {#key model.generation}
            <Portrait
              path={frame.portrait}
              characterId={frame.id}
              generation={model.generation}
              imageClass="character-details-image"
              alt={frame.name}
              failed={(_characterId, generation) => send({ type: "portrait-failed", generation })}
            />
          {/key}
        {/if}
      {/if}
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (The independently scrollable region must be reachable by keyboard.) -->
    <!-- biome-ignore-start lint/a11y/noNoninteractiveTabindex: The independently scrollable region must be keyboard reachable. -->
    <!-- biome-ignore lint/a11y/useSemanticElements: This existing independently scrollable div owns native scrolling. -->
    <div
      class="character-details-info"
      tabindex="0"
      role="region"
      aria-label="能力と状態"
      aria-describedby="character-details-scroll-hint"
      bind:this={information}
      onscroll={scroll}
      onfocus={() => send({ type: "focused", target: { kind: "information" } })}
    >
      <dl class="character-details-stats" data-details-stats>
        {#each frame?.stats ?? [] as [label, value, reason]}
          <div>
            <dt>{label}</dt>
            <dd>
              <span>{value}</span>
              {#if reason}
                <p>{reason}</p>
              {/if}
            </dd>
          </div>
        {/each}
      </dl>
      <p class="character-details-symptoms" data-details-symptoms hidden={!frame?.symptoms}>{frame?.symptoms ?? ""}</p>
      <p class="character-details-unavailable" data-details-unavailable hidden={!frame?.unavailable}>
        {frame?.unavailable ?? ""}
      </p>
      <section class="character-details-skills" aria-label="習得スキル" data-details-skills>
        <h3>習得スキル</h3>
        {#if !frame?.skills.length}
          <p>{frame?.emptySkills ?? ""}</p>
        {:else}
          {#each frame.skills as skill}
            <section class="character-details-skill">
              <h4>{skill.name}</h4>
              {#each [skill.kind, ...skill.notes] as line}
                <p>{line}</p>
              {/each}
            </section>
          {/each}
        {/if}
      </section>
    </div>
    <!-- biome-ignore-end lint/a11y/noNoninteractiveTabindex: End of keyboard scroll region. -->
  </div>
</dialog>
