<script lang="ts">
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";

let { member }: { member: BattleHudFrame["queue"][number] } = $props();
</script>
<li
  class="queue-row"
  class:current={member.current}
  class:enemy={member.enemy}
  aria-current={member.current ? "step" : undefined}
  aria-label={member.label}
>
  <span class="queue-portrait"><img alt="" src={`${import.meta.env.BASE_URL}assets/${member.portrait}`}></span
  ><span class="queue-name">{member.name}</span>
  {#if !member.current}
    <span class="queue-value"><b>{member.ticks}</b></span>
  {/if}
</li>
