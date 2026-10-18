<script lang="ts">
import { onMount } from "svelte";
import type { PartyEvent, PartyFocus } from "../../../presentation/partyModel";
import type { PartyFrame } from "../../../presentation/partyProjection";
import CharacterDetails from "../CharacterDetails/CharacterDetails.svelte";
import PartyCandidate from "../PartyCandidate/PartyCandidate.svelte";
import PartyFooterAction from "../PartyFooterAction/PartyFooterAction.svelte";
import PartySlot from "../PartySlot/PartySlot.svelte";
import "../../party.css";

let { root, frame, send }: { root?: HTMLElement; frame: PartyFrame | null; send: (event: PartyEvent) => boolean } =
  $props();
let internalRoot = $state<HTMLDivElement>();
let scope = $derived(root ?? internalRoot);

let selection = $state<HTMLDialogElement>();
let selectionModalOpen = $state(false);
let grid = $state<HTMLDivElement>();
let selected = $derived(frame?.selection ?? null);
let target = $derived(frame?.focus ?? null);
function focusNode(focus: PartyFocus | null) {
  if (!focus) return null;
  const selector =
    focus.kind === "slot"
      ? `[data-slot="${focus.slot}"]`
      : focus.kind === "candidate"
        ? `.party-candidate[value="${CSS.escape(focus.characterId)}"]`
        : focus.kind === "detail"
          ? `.party-detail[data-character-id="${CSS.escape(focus.characterId)}"]`
          : focus.kind === "back"
            ? "[data-party-back]"
            : focus.kind === "depart"
              ? "[data-depart]"
              : "[data-confirm]";
  return scope?.querySelector<HTMLElement>(selector);
}
onMount(() => {
  const owner = scope;
  if (!owner) return;
  owner.classList.add("ui-screen", "formation-screen");
  const key = (event: KeyboardEvent) => {
    if (send({ type: "key", key: event.key, shift: event.shiftKey })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  owner.addEventListener("keydown", key);
  return () => {
    owner.removeEventListener("keydown", key);
    if (selection?.open) selection?.close();
  };
});
$effect(() => {
  if (!scope) return;
  scope.hidden = !frame?.visible;
  scope.classList.toggle("is-selecting", selected !== null);
});
$effect(() => {
  if (!frame) return;
  if (selected && !selection?.open) selection?.showModal();
  else if (!selected && selection?.open) selection?.close();
  selectionModalOpen = selection?.open ?? false;
  if (selected && grid && grid.scrollTop !== selected.scrollTop) grid.scrollTop = selected.scrollTop;
});
$effect(() => {
  if (frame?.details.dialog) return;
  const node = focusNode(target);
  if (node && node !== document.activeElement) node.focus({ preventScroll: target?.kind === "slot" });
});
</script>

{#snippet content()}
  {#if frame && scope}
    <header class="party-heading">
      <h2 class="ui-title" data-party-title>{frame.title}</h2>
      <p class="sr-only" data-party-calendar>{frame.calendar}</p>
    </header>
    <div class="party-workspace">
      <div class="party-slots" data-party-slots>
        {#each frame.slots as { slot, member } (slot)}
          <PartySlot {slot} {member} portraitGeneration={frame.portraitGeneration} {send} />
        {/each}
      </div>
    </div>
    <footer class="party-footer ui-actions">
      <PartyFooterAction
        action="back"
        data-party-back
        onclick={() => send({ type: "back" })}
        onfocus={() => send({ type: "focused", target: { kind: "back" } })}
      />
      <p class="sr-only" id="party-status" role="status" aria-live="polite" data-party-status>{frame.status}</p>
      <PartyFooterAction
        action="depart"
        aria-describedby="party-status"
        data-depart
        hidden={!frame.departure.visible}
        disabled={frame.departure.disabled}
        onclick={() => send({ type: "depart" })}
        onfocus={() => send({ type: "focused", target: { kind: "depart" } })}
      />
    </footer>
    <dialog
      class="party-selection ui-dialog"
      aria-labelledby="party-selection-title"
      bind:this={selection}
      oncancel={(event) => {
  event.preventDefault();
  event.stopPropagation();
  send({ type: "confirm" });
}}
    >
      <header class="party-heading"><h2 class="ui-title" id="party-selection-title">仲間を選択</h2></header>
      <div class="party-candidates">
        <!-- biome-ignore lint/a11y/useSemanticElements: The candidate card grid is a group, not a form fieldset. -->
        <div
          class="party-candidate-grid"
          role="group"
          aria-label="候補一覧"
          bind:this={grid}
          onscroll={() => send({ type: "selection-scrolled", scrollTop: grid?.scrollTop ?? 0 })}
        >
          {#each selected?.candidates ?? [] as member, index (member.id)}
            <PartyCandidate {member} {index} portraitGeneration={frame.portraitGeneration} {send} />
          {/each}
        </div>
      </div>
      <footer class="party-footer ui-actions">
        <p class="sr-only" role="status" aria-live="polite" data-selection-status>{selected?.status ?? ""}</p>
        <PartyFooterAction
          action="confirm"
          data-confirm
          onclick={() => send({ type: "confirm" })}
          onfocus={() => send({ type: "focused", target: { kind: "confirm" } })}
        />
      </footer>
    </dialog>
    <CharacterDetails
      model={frame.details}
      modalReady={!selected || selectionModalOpen}
      send={(event) => send({ type: "details", event })}
      focusOpener={(characterId) => focusNode({ kind: "detail", characterId })?.focus({ preventScroll: true })}
    />
  {/if}
{/snippet}

{#if root}
  {@render content()}
{:else}
  <div class="party-editor" bind:this={internalRoot}>{@render content()}</div>
{/if}
