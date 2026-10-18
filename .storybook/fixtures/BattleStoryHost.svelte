<script lang="ts">
import type { Snippet } from "svelte";

let {
  children,
  scope = "battle",
  arrangement = "flow",
}: {
  children: Snippet;
  scope?: "battle" | "enemy";
  arrangement?: "flow" | "disclosure" | "sequence" | "finish";
} = $props();
</script>
<div
  class:battle-ui={scope === "battle"}
  class:with-skills={scope === "battle"}
  data-skill-battle={scope === "battle" ? "" : undefined}
  style:height="100%"
>
  {#if arrangement === "disclosure"}
    <div class="symptom-icons">{@render children()}</div>
  {:else if arrangement === "sequence"}
    <div class="sequence-controls">{@render children()}</div>
  {:else if arrangement === "finish"}
    <div class="battle-result-controls">{@render children()}</div>
  {:else}
    {@render children()}
  {/if}
</div>
