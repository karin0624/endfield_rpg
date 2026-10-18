<script lang="ts">
import type { BattleHudFrame } from "../../presentation/battleViewProjection";

let { member }: { member: BattleHudFrame["enemies"][number] } = $props();
</script>
<!-- biome-ignore lint/a11y/useSemanticElements: A positioned combatant label is a group, not a form fieldset. -->
<div
  class="enemy-world-label"
  class:defeated={member.defeated}
  class:selected={member.selected}
  data-enemy-label={member.id}
  role="group"
  aria-label={member.label}
>
  <div class="enemy-world-heading">
    <strong data-enemy-name>{member.name}</strong><span class="enemy-world-hp" data-enemy-hp>{member.hp}</span>
  </div>
  <span class="enemy-world-state" data-enemy-state>{member.defeated ? "戦闘不能" : ""}</span
  ><span class="hp-track enemy-world-track" aria-hidden="true"
    ><span style:width={`${member.fraction * 100}%`}></span></span
  >
</div>
