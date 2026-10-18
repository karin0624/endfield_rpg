<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";

let attributes: HTMLButtonAttributes = $props();
</script>
<button type="button" class="command" data-item-cancel data-branch-focus="cancel" {...attributes}>戻る</button>
