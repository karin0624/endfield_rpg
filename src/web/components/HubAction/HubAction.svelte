<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLButtonAttributes } from "svelte/elements";
import "../../hub.css";

let {
  primary = false,
  icon,
  label,
  children,
  class: className = "",
  ...attributes
}: HTMLButtonAttributes & {
  primary?: boolean;
  icon?: "menu" | "close";
  label?: string;
  children?: Snippet;
} = $props();
</script>

<button
  type="button"
  {...attributes}
  class={`ui-action${primary ? " primary" : ""}${icon === "menu" ? " system-entry" : icon === "close" ? " icon-button" : ""}${className ? ` ${className}` : ""}`}
>
  {#if icon === "menu"}
    <svg class="ui-glyph" viewBox="0 0 23 18" aria-hidden="true"><path d="M1 1H21.5M1 9H21.5M1 17H21.5" /></svg
    ><span>{label ?? "メニュー"}</span>
  {:else if icon === "close"}
    <svg class="ui-glyph" viewBox="4 4 16 16" aria-hidden="true"><path d="M5 5L19 19M19 5L5 19" /></svg>
  {:else if children}
    {@render children()}
  {:else}
    {label ?? ""}
  {/if}
</button>
