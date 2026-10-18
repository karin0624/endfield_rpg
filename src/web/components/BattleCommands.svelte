<script lang="ts">
import type { BattleModelEvent } from "../../presentation/battleModel";
import type { BattleHudFrame } from "../../presentation/battleViewProjection";
import BattleAttack from "./BattleAttack.svelte";
import BattleItemDialog from "./BattleItemDialog.svelte";
import BattleItemTrigger from "./BattleItemTrigger.svelte";
import BattleSequenceControls from "./BattleSequenceControls.svelte";
import BattleSkillPanel from "./BattleSkillPanel.svelte";
import BattleSkillsTrigger from "./BattleSkillsTrigger.svelte";

let { frame, dispatch }: { frame: BattleHudFrame; dispatch: (event: BattleModelEvent) => boolean } = $props();
</script>
<section class="commands panel" aria-labelledby="command-title">
  <h2 id="command-title">行動を選択</h2>
  <BattleAttack enabled={frame.attack.enabled} visible={frame.attack.visible} {dispatch} />
  <BattleSkillsTrigger enabled={frame.skills.enabled} visible={frame.skills.triggerVisible} {dispatch} />
  <BattleSkillPanel skills={frame.skills} {dispatch} />
  <p class="skill-result" data-skill-result hidden={!frame.summary.visible}>{frame.summary.text}</p>
  <BattleSequenceControls controls={frame.controls} {dispatch} />
  <BattleItemTrigger enabled={frame.items.enabled} visible={frame.items.visible} label={frame.items.label} {dispatch} />
  <BattleItemDialog items={frame.items} {dispatch} />
</section>
