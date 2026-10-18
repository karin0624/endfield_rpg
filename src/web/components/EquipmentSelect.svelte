<script lang="ts">
import type { HTMLSelectAttributes } from "svelte/elements";
import "../items.css";

let {
  options,
  ...attributes
}: HTMLSelectAttributes & { options: readonly { value: string; label: string; disabled?: boolean }[] } = $props();
</script>
<select class="item-equipment-select" {...attributes}>
  {#each options as option (option.value)}
    <option value={option.value} disabled={option.disabled}>{option.label}</option>
  {/each}
</select>
