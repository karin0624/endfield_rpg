<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
import BattleCommand from "../BattleCommand/BattleCommand.svelte";

let {
  label,
  enabled = true,
  visible = true,
  dispatch,
}: { label: string; enabled?: boolean; visible?: boolean; dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<BattleCommand kind="item" {label} {enabled} {visible} {dispatch} />
