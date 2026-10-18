<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";

let { label, ...attributes }: HTMLButtonAttributes & { label: string } = $props();
</script>
<button type="button" class="dungeon-outcome-return" data-return-town data-single-activation {...attributes}>
  {label}
</button>
