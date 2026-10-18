<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";
import "../items.css";

let {
  label,
  element = $bindable(),
  ...attributes
}: Omit<HTMLButtonAttributes, "class"> & { label: string; element?: HTMLButtonElement } = $props();
</script>
<button class="command" type="button" {...attributes} bind:this={element}>{label}</button>
