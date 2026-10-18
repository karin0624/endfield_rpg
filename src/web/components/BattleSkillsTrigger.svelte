<script lang="ts">
import type { BattleModelEvent } from "../../presentation/battleModel";
import BattleCommand from "./BattleCommand.svelte";

let {
  enabled = true,
  visible = true,
  dispatch,
}: { enabled?: boolean; visible?: boolean; dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<BattleCommand kind="skills" {enabled} {visible} {dispatch} />
