<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
import BattleCommand from "../BattleCommand/BattleCommand.svelte";

let { dispatch }: { dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<BattleCommand kind="cancel-skill" {dispatch} />
