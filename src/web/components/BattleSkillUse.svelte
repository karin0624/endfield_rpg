<script lang="ts">
import type { BattleModelEvent } from "../../presentation/battleModel";
import BattleCommand from "./BattleCommand.svelte";

let { enabled = true, dispatch }: { enabled?: boolean; dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<BattleCommand kind="use-skill" {enabled} {dispatch} />
