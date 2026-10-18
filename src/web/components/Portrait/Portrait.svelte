<script lang="ts">
import { untrack } from "svelte";

let {
  path,
  characterId,
  generation,
  failed,
  imageClass,
  alt = "",
}: {
  path: string | undefined;
  characterId: string;
  generation: number;
  failed: (characterId: string, generation: number) => void;
  imageClass: string;
  alt?: string;
} = $props();
// The caller keys this image owner by generation. A late error belongs to that mounted owner.
const owner = untrack(() => ({ characterId, generation }));
</script>

{#if path}
  <img
    class={imageClass}
    src={`${import.meta.env.BASE_URL}assets/${path}`}
    {alt}
    onerror={() => failed(owner.characterId, owner.generation)}
  >
{:else}
  画像なし
{/if}
