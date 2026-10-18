<script lang="ts">
import { onMount } from "svelte";
import "../../hub.css";

let { messages, scene = "home" }: { messages: readonly string[]; scene?: "home" | "town" } = $props();
let element: HTMLDivElement;
function layout() {
  const scrollable = element.scrollHeight > element.clientHeight + 1;
  element.setAttribute("role", scrollable ? "region" : "status");
  if (scrollable) {
    element.tabIndex = 0;
    element.setAttribute("aria-label", scene === "town" ? "活動の結果" : "直前の結果");
  } else {
    element.removeAttribute("tabindex");
    element.removeAttribute("aria-label");
  }
}
onMount(() => {
  const observer = new ResizeObserver(layout);
  observer.observe(element);
  layout();
  return () => observer.disconnect();
});
</script>

<div class="result" role="status" bind:this={element}>{messages.join("\n")}</div>
