<script lang="ts">
import "../battleHud.css";
import type { BattleModelEvent } from "../../presentation/battleModel";

let { visible = true, dispatch }: { visible?: boolean; dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<button
  type="button"
  data-sequence-skip
  data-focus="skip"
  hidden={!visible}
  onclick={() => dispatch({ type: "playback", event: { type: "skip" } })}
  onfocus={() => dispatch({ type: "focused", target: { kind: "skip" } })}
>
  演出を省略
</button>
