<script lang="ts">
import type { HTMLInputAttributes } from "svelte/elements";
import "../../items.css";

let {
  kind = "quantity",
  element = $bindable(),
  ...attributes
}: Omit<HTMLInputAttributes, "type" | "class"> & { kind?: "quantity" | "carry"; element?: HTMLInputElement } = $props();
</script>
<span class="item-number-control" class:item-carry-control={kind === "carry"}
  ><input
    class={kind === "carry" ? "item-carry-input" : "item-quantity-input"}
    type="number"
    {...attributes}
    bind:this={element}
  ></span
>
