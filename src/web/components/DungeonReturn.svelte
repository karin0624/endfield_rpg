<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";

let { label, ...attributes }: HTMLButtonAttributes & { label: string } = $props();
</script>
<button type="button" class="dungeon-town-link" data-return-town data-single-activation {...attributes}>{label}</button>
