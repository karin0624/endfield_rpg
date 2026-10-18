<script lang="ts">
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";
import BattleQueueRow from "../BattleQueueRow/BattleQueueRow.svelte";

let { queue }: { queue: BattleHudFrame["queue"] } = $props();
</script>
<section class="timeline panel" aria-label="行動順">
  <ol class="queue" data-timeline aria-label="行動順。数値は次の行動までの整数tick">
    {#each queue as member}
      <BattleQueueRow {member} />
    {/each}
  </ol>
</section>
