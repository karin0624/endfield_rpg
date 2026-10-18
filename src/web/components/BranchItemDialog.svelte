<script lang="ts">
import { onDestroy } from "svelte";
import type { BranchRecoveryEvent } from "../../presentation/branchRecoveryModel";
import type { DungeonChromeFrame } from "../../presentation/dungeonProjection";
import BranchItemPanel from "./BranchItemPanel.svelte";

let {
  frame,
  send,
  open = true,
}: {
  frame: DungeonChromeFrame["branch"];
  send: (event: BranchRecoveryEvent) => boolean;
  open?: boolean;
} = $props();
let dialog: HTMLDialogElement;
$effect(() => {
  if (open && !dialog.open) dialog.showModal();
  if (!open && dialog.open) dialog.close();
});
function key(event: KeyboardEvent) {
  if (send({ type: "key", key: event.key, shift: event.shiftKey })) event.preventDefault();
  event.stopPropagation();
}
function cancel(event: Event) {
  event.preventDefault();
  send({ type: "cancel" });
}
onDestroy(() => {
  if (dialog?.open) dialog.close();
});
</script>

<dialog class="branch-item-modal" aria-label="HP回復品の使用" bind:this={dialog} oncancel={cancel} onkeydown={key}>
  <BranchItemPanel {frame} {send} />
</dialog>
