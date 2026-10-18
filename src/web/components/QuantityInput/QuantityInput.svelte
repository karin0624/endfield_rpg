<script lang="ts">
import type { HTMLInputAttributes } from "svelte/elements";
import NumberInput from "../NumberInput/NumberInput.svelte";

let {
  element = $bindable(),
  ...attributes
}: Omit<HTMLInputAttributes, "class" | "type"> & { element?: HTMLInputElement } = $props();
</script>
<NumberInput kind="quantity" {...attributes} bind:element />
