<script lang="ts">
import "../battleHud.css";
import type { BattleModelEvent } from "../../presentation/battleModel";

let { id, speed, dispatch }: { id?: string; speed: 0 | 1 | 2; dispatch: (event: BattleModelEvent) => boolean } =
  $props();
</script>
<select
  {id}
  class="battle-sequence-speed"
  data-sequence-speed
  data-focus="speed"
  aria-label="演出速度"
  value={String(speed)}
  onchange={(event) =>
  dispatch({ type: "playback", event: { type: "speed", speed: Number(event.currentTarget.value) as 0 | 1 | 2 } })}
  onfocus={() => dispatch({ type: "focused", target: { kind: "speed" } })}
>
  <option value="1">1倍</option>
  <option value="2">2倍</option>
  <option value="0">即時</option>
</select>
