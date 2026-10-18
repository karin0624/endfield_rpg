<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";
import "../../items.css";

let { label, ...attributes }: HTMLButtonAttributes & { label: string } = $props();
</script>
<button type="button" class="command item-trigger" data-branch-focus="item-trigger" {...attributes}>{label}</button>
