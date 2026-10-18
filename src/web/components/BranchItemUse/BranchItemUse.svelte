<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";

let attributes: HTMLButtonAttributes = $props();
</script>
<button type="button" class="command" data-item-use data-branch-focus="item-use" {...attributes}>使用する</button>
