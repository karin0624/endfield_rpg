<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";

let {
  symptom,
  allyId,
  dispatch,
}: {
  symptom: BattleHudFrame["allies"][number]["symptoms"][number];
  allyId: string;
  dispatch: (event: BattleModelEvent) => boolean;
} = $props();
const focused = (target: import("../../../presentation/battleModel").BattleFocus) =>
  dispatch({ type: "focused", target });
</script>
<details class="symptom-icon" data-symptom={symptom.kind} open={symptom.open}>
  <!-- biome-ignore lint/a11y/noStaticElementInteractions: Native summary controls a details disclosure through the synchronous model. -->
  <summary
    onclick={(event) => {
  event.preventDefault();
  dispatch({ type: "toggle-symptom", id: allyId, symptom: symptom.kind });
}}
    onfocus={() => focused({ kind: "symptom", id: allyId, symptom: symptom.kind })}
  >
    <span class="symptom-mark" aria-hidden="true">{symptom.icon}</span><span>{symptom.label}</span>
  </summary>
  <span class="symptom-description">{symptom.detail}</span>
</details>
