<script lang="ts">
import "../../items.css";

let {
  visible,
  element = $bindable(),
  onclick,
}: { visible: boolean; element?: HTMLButtonElement; onclick: () => void } = $props();
</script>
<button type="button" class="command item-shop-trigger" hidden={!visible} bind:this={element} {onclick}>買物</button>
