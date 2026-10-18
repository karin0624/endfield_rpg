<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";
import "../party.css";

let { name, characterId, ...attributes }: HTMLButtonAttributes & { name: string; characterId: string } = $props();
</script>

<button type="button" class="party-detail" data-character-id={characterId} aria-label={`${name}の詳細`} {...attributes}>
  詳細<span aria-hidden="true">{" ›"}</span>
</button>
