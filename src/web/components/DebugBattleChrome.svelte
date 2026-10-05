<script lang="ts">
import type { DebugBattleEvent } from "../../presentation/debugBattleModel";

let {
  ready,
  editor,
  focus,
  dispatch,
}: {
  ready: boolean;
  editor: boolean;
  focus: "town" | "editor" | null;
  dispatch: (event: DebugBattleEvent) => boolean;
} = $props();
let town: HTMLAnchorElement;
let editorLink = $state<HTMLAnchorElement>();
$effect(() => {
  const node = focus === "town" ? town : focus === "editor" ? editorLink : null;
  if (node && node !== document.activeElement) node.focus();
});
function key(event: KeyboardEvent) {
  if (dispatch({ type: "key", key: event.key, shift: event.shiftKey })) {
    event.preventDefault();
    event.stopPropagation();
  }
}
</script>
<!-- Bubbled child keys belong to the synchronous focus model. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- biome-ignore lint/a11y/noStaticElementInteractions: Child control keys bubble to the synchronous focus model. -->
<div class="battle-utility-controls" hidden={!ready} onkeydown={key}>
  <a href="?debug=1" bind:this={town} onfocus={() => dispatch({ type: "utility-focused", target: "town" })}>街へ戻る</a>
  {#if editor}
    {"\n          "}<a
      href="?debug=1&edit=1"
      bind:this={editorLink}
      onfocus={() => dispatch({ type: "utility-focused", target: "editor" })}
      >構図設定</a
    >
  {/if}
</div>
