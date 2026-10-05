<script lang="ts">
import { onMount } from "svelte";
import type { PartyEvent, PartyFocus } from "../../presentation/partyModel";
import type { PartyFrame } from "../../presentation/partyProjection";
import CharacterDetails from "./CharacterDetails.svelte";
import Portrait from "./Portrait.svelte";
import "../party.css";

let { root, frame, send }: { root: HTMLElement; frame: PartyFrame | null; send: (event: PartyEvent) => boolean } =
  $props();
let selection = $state<HTMLDialogElement>();
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
  return root.querySelector<HTMLElement>(selector);
}
onMount(() => {
  root.classList.add("ui-screen", "formation-screen");
  const key = (event: KeyboardEvent) => {
    if (send({ type: "key", key: event.key, shift: event.shiftKey })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  root.addEventListener("keydown", key);
  return () => {
    root.removeEventListener("keydown", key);
    if (selection?.open) selection?.close();
  };
});
$effect(() => {
  root.hidden = !frame?.visible;
  root.classList.toggle("is-selecting", selected !== null);
});
$effect(() => {
  if (!frame) return;
  if (selected && !selection?.open) selection?.showModal();
  else if (!selected && selection?.open) selection?.close();
  if (selected && grid && grid.scrollTop !== selected.scrollTop) grid.scrollTop = selected.scrollTop;
});
$effect(() => {
  if (frame?.details.dialog) return;
  const node = focusNode(target);
  if (node && node !== document.activeElement) node.focus({ preventScroll: target?.kind === "slot" });
});
</script>

{#if frame}
  <header class="party-heading">
    <h2 class="ui-title" data-party-title>{frame.title}</h2>
    <p class="sr-only" data-party-calendar>{frame.calendar}</p>
  </header>
  <div class="party-workspace">
    <div class="party-slots" data-party-slots>
      {#each frame.slots as { slot, member } (slot)}
        <div class="party-slot" class:is-occupied={member !== null}>
          <button
            type="button"
            class="party-slot-choice"
            data-slot={slot}
            aria-label={`枠 ${slot + 1}`}
            {...{ "aria-description": member ? `${member.name} ${member.hp} ${member.symptoms}` : "空き枠。仲間を選択" }}
            onclick={() => send({ type: "open-selection", slot })}
            onfocus={() => send({ type: "focused", target: { kind: "slot", slot } })}
          >
            <span class="party-slot-portrait" aria-hidden="true"
              >{#if member}
                {#key `${frame.portraitGeneration}:${member.id}`}
                  <Portrait
                    path={member.portrait}
                    characterId={member.id}
                    generation={frame.portraitGeneration}
                    imageClass="party-character-image"
                    failed={(characterId, generation) => send({ type: "portrait-failed", characterId, generation })}
                  />
                {/key}
              {:else}
                +
              {/if}</span
            >
            {#if member}
              <span class="party-slot-name">{member.name}</span
              ><span class="party-hp-bar" aria-hidden="true"><i style:width={`${member.ratio * 100}%`}></i></span
              ><span class="party-slot-hp">{member.hp}</span><span class="party-slot-symptoms">{member.symptoms}</span>
            {/if}
          </button>
        </div>
      {/each}
    </div>
  </div>
  <footer class="party-footer ui-actions">
    <button
      class="party-back ui-button ui-back"
      type="button"
      data-party-back
      onclick={() => send({ type: "back" })}
      onfocus={() => send({ type: "focused", target: { kind: "back" } })}
    >
      戻る
    </button>
    <p class="sr-only" id="party-status" role="status" aria-live="polite" data-party-status>{frame.status}</p>
    <button
      class="party-depart ui-button ui-primary"
      type="button"
      aria-describedby="party-status"
      data-depart
      hidden={!frame.departure.visible}
      disabled={frame.departure.disabled}
      onclick={() => send({ type: "depart" })}
      onfocus={() => send({ type: "focused", target: { kind: "depart" } })}
    >
      出発する
    </button>
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
          <div
            class="party-candidate-card"
            class:has-symptoms={!!member.symptoms}
            class:is-selected={member.number > 0}
          >
            <button
              type="button"
              class="party-candidate"
              value={member.id}
              aria-label={member.name}
              aria-describedby={`candidate-hp-${index} candidate-state-${index} candidate-symptoms-${index}`}
              aria-pressed={member.number > 0}
              aria-disabled={member.unavailable}
              title={member.reason}
              {...{ "aria-description": member.reason }}
              onclick={() => send({ type: "toggle", characterId: member.id })}
              onfocus={() => send({ type: "focused", target: { kind: "candidate", characterId: member.id } })}
            >
              <span class="party-candidate-face" aria-hidden="true"
                >{#key frame.portraitGeneration}
                  <Portrait
                    path={member.portrait}
                    characterId={member.id}
                    generation={frame.portraitGeneration}
                    imageClass="party-character-image"
                    failed={(characterId, generation) => send({ type: "portrait-failed", characterId, generation })}
                  />
                {/key}</span
              >
              <span class="party-order" aria-hidden="true">{member.number || ""}</span
              ><span class="party-candidate-name">{member.name}</span
              ><span class="sr-only party-candidate-state" id={`candidate-state-${index}`}
                >{member.selectionLabel}</span
              >
            </button>
            <div class="party-candidate-info">
              <span class="party-candidate-hp" id={`candidate-hp-${index}`}>{member.hp}</span>
              <button
                type="button"
                class="party-detail"
                data-character-id={member.id}
                aria-label={`${member.name}の詳細`}
                onclick={() => send({ type: "show-details", characterId: member.id })}
                onfocus={() => send({ type: "focused", target: { kind: "detail", characterId: member.id } })}
              >
                詳細<span aria-hidden="true">{" ›"}</span>
              </button>
              <span class="party-hp-bar" aria-hidden="true"><i style:width={`${member.ratio * 100}%`}></i></span>
            </div>
            <span class="party-candidate-symptoms" id={`candidate-symptoms-${index}`}>{member.symptoms}</span>
          </div>
        {/each}
      </div>
    </div>
    <footer class="party-footer ui-actions">
      <p class="sr-only" role="status" aria-live="polite" data-selection-status>{selected?.status ?? ""}</p>
      <button
        type="button"
        class="ui-button ui-primary"
        data-confirm
        onclick={() => send({ type: "confirm" })}
        onfocus={() => send({ type: "focused", target: { kind: "confirm" } })}
      >
        確定
      </button>
    </footer>
  </dialog>
  <CharacterDetails
    model={frame.details}
    send={(event) => send({ type: "details", event })}
    focusOpener={(characterId) => focusNode({ kind: "detail", characterId })?.focus({ preventScroll: true })}
  />
{/if}
