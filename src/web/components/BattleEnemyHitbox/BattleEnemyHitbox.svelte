<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";

let {
  member,
  dispatch,
}: { member: BattleHudFrame["enemies"][number]; dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<button
  type="button"
  class="enemy-hitbox"
  data-combatant-id={member.id}
  aria-describedby="battle-screen-reader-status"
  disabled={member.disabled}
  aria-pressed={member.pressed}
  aria-label={`${member.label}、攻撃対象に選択`}
  onclick={() => dispatch({ type: "select-enemy", id: member.id })}
  onfocus={() => dispatch({ type: "focused", target: { kind: "enemy", id: member.id } })}
></button>
