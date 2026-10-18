<script lang="ts">
import type { BattleModelEvent } from "../../presentation/battleModel";
import BattleTargetSelect from "./BattleTargetSelect.svelte";

let {
  id,
  value,
  options,
  dispatch,
}: {
  id?: string;
  value: string | null;
  options: readonly { id: string; text: string }[];
  dispatch: (event: BattleModelEvent) => boolean;
} = $props();
</script>
<BattleTargetSelect kind="item-target" {id} {value} {options} {dispatch} />
