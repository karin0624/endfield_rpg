<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";

let attributes: HTMLButtonAttributes = $props();
</script>
<button type="button" class="branch-skill-trigger" data-branch-focus="skill-trigger" {...attributes}>分岐で回復</button>
