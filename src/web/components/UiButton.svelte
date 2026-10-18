<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLButtonAttributes } from "svelte/elements";
import "../ui.css";

let {
  kind = "default",
  label,
  children,
  class: className = "",
  element = $bindable(),
  ...attributes
}: HTMLButtonAttributes & {
  kind?: "default" | "back" | "primary";
  label?: string;
  children?: Snippet;
  element?: HTMLButtonElement;
} = $props();
</script>

<button
  type="button"
  {...attributes}
  class={`ui-button${kind === "primary" ? " ui-primary" : kind === "back" ? " ui-back" : ""}${className ? ` ${className}` : ""}`}
  bind:this={element}
>
  {#if children}
    {@render children()}
  {:else}
    {label ?? ""}
  {/if}
</button>
