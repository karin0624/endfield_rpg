<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";
import BattleFinish from "../BattleFinish/BattleFinish.svelte";

let { result, dispatch }: { result: BattleHudFrame["result"]; dispatch: (event: BattleModelEvent) => boolean } =
  $props();
</script>
<section class="battle-result panel" data-result role="status" aria-live="assertive" hidden={!result.visible}>
  <h2 data-result-title>{result.title}</h2>
  <p data-result-detail>{result.detail}</p>
  <BattleFinish {result} {dispatch} />
</section>
