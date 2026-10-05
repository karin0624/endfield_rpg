<script lang="ts">
import { onDestroy } from "svelte";
import type { projectTownShop, TownEvent } from "../../presentation/townModel";
import "../items.css";

let { frame, send }: { frame: ReturnType<typeof projectTownShop>; send: (event: TownEvent) => boolean } = $props();
let dialog: HTMLDialogElement,
  trigger: HTMLButtonElement,
  quantity: HTMLInputElement,
  buy: HTMLButtonElement,
  close: HTMLButtonElement;
$effect(() => {
  if (frame.open && !dialog.open) dialog.showModal();
  else if (!frame.open && dialog.open) dialog.close();
});
$effect(() => {
  const node =
    frame.focus === "quantity"
      ? quantity
      : frame.focus === "buy"
        ? buy
        : frame.focus === "close"
          ? close
          : frame.focus === "trigger"
            ? trigger
            : null;
  if (node && node !== document.activeElement) node.focus();
});
onDestroy(() => {
  if (dialog?.open) dialog.close();
});
</script>

<button
  type="button"
  class="command item-shop-trigger"
  hidden={!frame.visible}
  bind:this={trigger}
  onclick={() => send({ type: "shop-open" })}
>
  買物
</button>
<dialog
  class="item-dialog"
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
  <h2>市場の買物</h2>
  <p data-shop-offer>{frame.offer}</p>
  <p data-shop-balance>{frame.summary}</p>
  <label
    >購入個数<input
      type="number"
      min="1"
      step="1"
      data-shop-quantity
      value={frame.quantity ?? ""}
      bind:this={quantity}
      oninput={(event) =>
  send({
    type: "shop-quantity",
    quantity: Number.isNaN(event.currentTarget.valueAsNumber) ? null : event.currentTarget.valueAsNumber,
  })}
      onfocus={() => send({ type: "shop-focused", target: "quantity" })}
    ></label
  >
  <p role="status" data-shop-result>{frame.message}</p>
  <div class="item-actions">
    <button
      class="command"
      type="button"
      data-shop-buy
      disabled={!frame.canBuy}
      bind:this={buy}
      onclick={() => send({ type: "shop-buy" })}
      onfocus={() => send({ type: "shop-focused", target: "buy" })}
    >
      購入する
    </button>
    <button
      class="command"
      type="button"
      data-shop-close
      bind:this={close}
      onclick={() => send({ type: "shop-close" })}
      onfocus={() => send({ type: "shop-focused", target: "close" })}
    >
      買物を閉じる
    </button>
  </div>
</dialog>
