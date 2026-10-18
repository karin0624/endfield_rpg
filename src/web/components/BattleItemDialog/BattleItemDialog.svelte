<script lang="ts">
import "../../items.css";
import { onDestroy } from "svelte";
import type { BattleModelEvent } from "../../../presentation/battleModel";
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";
import BattleItemDialogPanel from "../BattleItemDialogPanel/BattleItemDialogPanel.svelte";

let { items, dispatch }: { items: BattleHudFrame["items"]; dispatch: (event: BattleModelEvent) => boolean } = $props();
let dialog: HTMLDialogElement;
$effect(() => {
  if (items.open && !dialog.open) dialog.showModal();
  else if (!items.open && dialog.open) dialog.close();
});
onDestroy(() => {
  if (dialog?.open) dialog.close();
});
</script>
<dialog
  class="item-modal"
  aria-label="HP回復品の使用"
  bind:this={dialog}
  oncancel={(event) => {
  event.preventDefault();
  dispatch({ type: "cancel-item" });
}}
>
  <BattleItemDialogPanel {items} {dispatch} />
</dialog>
