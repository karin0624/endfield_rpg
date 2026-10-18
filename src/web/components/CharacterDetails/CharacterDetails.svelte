<script lang="ts">
import { onDestroy } from "svelte";
import type { CharacterDetailsInteraction, CharacterDetailsModel } from "../../../presentation/characterDetails";
import CharacterDetailsPanel from "../CharacterDetailsPanel/CharacterDetailsPanel.svelte";
import "../../party.css";

let {
  model,
  send,
  focusOpener,
  modalReady = true,
}: {
  model: CharacterDetailsModel;
  send: (event: CharacterDetailsInteraction) => boolean;
  focusOpener: (characterId: string) => void;
  modalReady?: boolean;
} = $props();
let dialog: HTMLDialogElement;
$effect(() => {
  if (model.dialog && modalReady && !dialog.open) dialog.showModal();
  else if (!model.dialog && dialog.open) dialog.close();
});
$effect(() => {
  if (model.focus?.kind === "opener") focusOpener(model.focus.characterId);
});
onDestroy(() => {
  if (dialog?.open) dialog.close();
});
</script>

<dialog
  class="character-details-modal"
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
  {#if model.dialog}
    <CharacterDetailsPanel {model} {send} />
  {/if}
</dialog>
