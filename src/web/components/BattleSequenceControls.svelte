<script lang="ts">
import "../battleHud.css";
import type { BattleModelEvent } from "../../presentation/battleModel";
import type { BattleHudFrame } from "../../presentation/battleViewProjection";
import BattleSequenceSkip from "./BattleSequenceSkip.svelte";
import BattleSequenceSpeed from "./BattleSequenceSpeed.svelte";

let { controls, dispatch }: { controls: BattleHudFrame["controls"]; dispatch: (event: BattleModelEvent) => boolean } =
  $props();
const controlId = $props.id();
</script>
<div class="sequence-controls" hidden={!controls.visible}>
  <label for={controlId}>演出 <BattleSequenceSpeed id={controlId} speed={controls.speed} {dispatch} /></label>
  <BattleSequenceSkip visible={controls.skip} {dispatch} />
</div>
