<script lang="ts">
import type { DungeonChromeFrame } from "../../presentation/dungeonProjection";

let {
  node,
  enter,
  focused,
  loaded,
}: {
  node: DungeonChromeFrame["route"]["nodes"][number];
  enter: (id: string) => void;
  focused: (id: string) => void;
  loaded?: () => void;
} = $props();
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
</script>

<button
  type="button"
  class="dungeon-route-node type-{node.type}"
  class:is-current={node.current}
  class:is-available={node.enabled}
  class:is-past-unselected={node.past}
  class:is-resolved={node.resolved}
  disabled={!node.enabled}
  data-node-id={node.id}
  data-node-type={node.type}
  data-node-state={node.status}
  aria-label={node.label}
  aria-current={node.current ? "location" : undefined}
  onclick={() => enter(node.id)}
  onfocus={() => focused(node.id)}
>
  <img src={assetUrl(node.icon)} alt="" draggable="false" decoding="sync" aria-hidden="true" onload={loaded}>
  {#if node.title !== null}
    <span class="dungeon-route-node-label">{node.title}</span>
  {/if}
</button>
