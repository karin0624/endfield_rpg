<script lang="ts">
import { onDestroy } from "svelte";
import type { projectTownShop, TownEvent } from "../../presentation/townModel";
import ShopDialogPanel from "./ShopDialogPanel.svelte";
import "../items.css";

let { frame, send }: { frame: ReturnType<typeof projectTownShop>; send: (event: TownEvent) => boolean } = $props();
let dialog: HTMLDialogElement;
let quantity = $state<HTMLInputElement>(),
  buy = $state<HTMLButtonElement>(),
  close = $state<HTMLButtonElement>();
$effect(() => {
  if (frame.open && !dialog.open) dialog.showModal();
  else if (!frame.open && dialog.open) dialog.close();
});
$effect(() => {
  const focus = frame.focus;
  const node = focus === "quantity" ? quantity : focus === "buy" ? buy : focus === "close" ? close : null;
  if (node && node !== document.activeElement) node.focus();
});
onDestroy(() => {
  if (dialog?.open) dialog.close();
});
</script>
<dialog
  class="item-modal"
  aria-label="市場の買物"
  bind:this={dialog}
  oncancel={(event) => {
  event.preventDefault();
  send({ type: "shop-close" });
}}
  onkeydown={(event) => {
  if (send({ type: "shop-key", key: event.key, shift: event.shiftKey })) event.preventDefault();
  event.stopPropagation();
}}
>
  <ShopDialogPanel {frame} {send} bind:quantity bind:buy bind:close />
</dialog>
