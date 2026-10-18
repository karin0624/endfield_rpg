<script lang="ts">
import type { BattleModelEvent } from "../../presentation/battleModel";
import type { BattleHudFrame } from "../../presentation/battleViewProjection";
import BattleAllyTarget from "./BattleAllyTarget.svelte";
import BattleSkillBack from "./BattleSkillBack.svelte";
import BattleSkillChoice from "./BattleSkillChoice.svelte";
import BattleSkillUse from "./BattleSkillUse.svelte";

let { skills, dispatch }: { skills: BattleHudFrame["skills"]; dispatch: (event: BattleModelEvent) => boolean } =
  $props();
const controlId = $props.id();
</script>
<div class="skill-panel" data-skill-panel hidden={!skills.visible}>
  <p data-skill-fatigue>{skills.fatigue}</p>
  <div data-skill-list>
    {#each skills.choices as choice (choice.id)}
      <BattleSkillChoice skillId={choice.id} label={choice.text} selected={choice.selected} {dispatch} />
    {/each}
  </div>
  <p data-skill-preview>{skills.preview}</p>
  <label for={controlId} data-ally-label hidden={!skills.allyTargetVisible}
    >回復対象<BattleAllyTarget id={controlId} value={skills.allyTargetId} options={skills.allies} {dispatch} /></label
  >
  <BattleSkillUse enabled={skills.useEnabled} {dispatch} />
  <BattleSkillBack {dispatch} />
</div>
