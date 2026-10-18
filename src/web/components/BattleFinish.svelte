<script lang="ts">
import type { BattleModelEvent } from "../../presentation/battleModel";
import type { BattleHudFrame } from "../../presentation/battleViewProjection";

let { result, dispatch }: { result: BattleHudFrame["result"]; dispatch: (event: BattleModelEvent) => boolean } =
  $props();
const focused = (target: import("../../presentation/battleModel").BattleFocus) => dispatch({ type: "focused", target });
</script>
<button
  type="button"
  class="primary battle-finish"
  data-rematch
  data-focus="finish"
  hidden={!result.visible}
  aria-label={result.finishAriaLabel}
  onclick={() => dispatch({ type: "finish" })}
  onfocus={() => focused({ kind: "finish" })}
>
  {result.finishLabel}
</button>
