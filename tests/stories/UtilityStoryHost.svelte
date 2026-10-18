<script lang="ts">
import type { Snippet } from "svelte";
import "../../src/web/items.css";
import "../../src/web/hub.css";

let {
  children,
  kind = "quantity",
}: {
  children: Snippet;
  kind?: "quantity" | "equipment" | "carry" | "command" | "dialog" | "trigger";
} = $props();
</script>
<div
  class:hub-theme={kind === "carry"}
  style:color={kind === "carry" ? undefined : "var(--text-primary)"}
  style:font-size="var(--font-size-body)"
  style:line-height={kind === "equipment" || kind === "quantity" ? "1.6" : undefined}
>
  {#if kind === "carry"}
    <div class="quantity">{@render children()}</div>
  {:else}
    {@render children()}
  {/if}
</div>
