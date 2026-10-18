<script lang="ts">
import type { projectTownShop, TownEvent } from "../../presentation/townModel";
import QuantityInput from "./QuantityInput.svelte";
import ShopCommand from "./ShopCommand.svelte";
import "../items.css";

let {
  frame,
  send,
  quantity = $bindable(),
  buy = $bindable(),
  close = $bindable(),
}: {
  frame: ReturnType<typeof projectTownShop>;
  send: (event: TownEvent) => boolean;
  quantity?: HTMLInputElement;
  buy?: HTMLButtonElement;
  close?: HTMLButtonElement;
} = $props();
const controlId = $props.id();
</script>
<section class="item-dialog" aria-label="市場の買物">
  <h2>市場の買物</h2>
  <p data-shop-offer>{frame.offer}</p>
  <p data-shop-balance>{frame.summary}</p>
  <label for={controlId}
    >購入個数<QuantityInput
      id={controlId}
      min="1"
      step="1"
      data-shop-quantity
      value={frame.quantity ?? ""}
      bind:element={quantity}
      oninput={(event) =>
  send({
    type: "shop-quantity",
    quantity: Number.isNaN(event.currentTarget.valueAsNumber) ? null : event.currentTarget.valueAsNumber,
  })}
      onfocus={() => send({ type: "shop-focused", target: "quantity" })}
    /></label
  >
  <p role="status" data-shop-result>{frame.message}</p>
  <div class="item-actions">
    <ShopCommand
      type="button"
      data-shop-buy
      disabled={!frame.canBuy}
      bind:element={buy}
      onclick={() => send({ type: "shop-buy" })}
      onfocus={() => send({ type: "shop-focused", target: "buy" })}
      label="購入する"
    />
    <ShopCommand
      type="button"
      data-shop-close
      bind:element={close}
      onclick={() => send({ type: "shop-close" })}
      onfocus={() => send({ type: "shop-focused", target: "close" })}
      label="買物を閉じる"
    />
  </div>
</section>
