<script lang="ts">
import "../../battleHud.css";
import type { BattleModelEvent } from "../../../presentation/battleModel";
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";
import BattleSymptom from "../BattleSymptom/BattleSymptom.svelte";

let { member, dispatch }: { member: BattleHudFrame["allies"][number]; dispatch: (event: BattleModelEvent) => boolean } =
  $props();
</script>
<article
  class="ally-card"
  class:active={member.active}
  class:defeated={member.defeated}
  data-ally-id={member.id}
  aria-current={member.active ? "true" : undefined}
  aria-label={member.label}
>
  <img class="ally-portrait" alt="" src={`${import.meta.env.BASE_URL}assets/${member.portrait}`}>
  <div class="ally-details">
    <div class="ally-heading"><strong>{member.name}</strong><span class="ally-status">{member.status}</span></div>
    <div class="hp-line"><span>HP</span><b>{member.hp}</b><span>/ {member.maximum}</span></div>
    <span class="hp-track" aria-hidden="true"><span style:width={`${member.fraction * 100}%`}></span></span>
    <div class="symptom-icons" hidden={!member.symptoms.length}>
      {#each member.symptoms as symptom (symptom.kind)}
        <BattleSymptom {symptom} allyId={member.id} {dispatch} />
      {/each}
    </div>
  </div>
</article>
