<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
import BattleCommand from "../BattleCommand/BattleCommand.svelte";

let {
  skillId,
  label,
  selected,
  dispatch,
}: { skillId: string; label: string; selected: boolean; dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<BattleCommand kind="skill" {skillId} {label} {selected} {dispatch} />
