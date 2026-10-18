<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";

let { label, ...attributes }: HTMLButtonAttributes & { label: string } = $props();
</script>
<button type="button" class="branch-skill-button" {...attributes}>{label}</button>
