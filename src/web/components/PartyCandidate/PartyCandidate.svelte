<script lang="ts">
import type { PartyEvent } from "../../../presentation/partyModel";
import type { PartyFrame } from "../../../presentation/partyProjection";
import PartyDetailAction from "../PartyDetailAction/PartyDetailAction.svelte";
import Portrait from "../Portrait/Portrait.svelte";
import "../../party.css";

let {
  member,
  index = 0,
  portraitGeneration = 0,
  send,
}: {
  member: NonNullable<PartyFrame["selection"]>["candidates"][number];
  index?: number;
  portraitGeneration?: number;
  send: (event: PartyEvent) => boolean;
} = $props();
</script>

<div class="party-candidate-card" class:has-symptoms={!!member.symptoms} class:is-selected={member.number > 0}>
  <button
    type="button"
    class="party-candidate"
    value={member.id}
    aria-label={member.name}
    aria-describedby={`candidate-hp-${index} candidate-state-${index} candidate-symptoms-${index}`}
    aria-pressed={member.number > 0}
    aria-disabled={member.unavailable}
    title={member.reason}
    {...{ "aria-description": member.reason }}
    onclick={() => send({ type: "toggle", characterId: member.id })}
    onfocus={() => send({ type: "focused", target: { kind: "candidate", characterId: member.id } })}
  >
    <span class="party-candidate-face" aria-hidden="true"
      >{#key portraitGeneration}
        <Portrait
          path={member.portrait}
          characterId={member.id}
          generation={portraitGeneration}
          imageClass="party-character-image"
          failed={(characterId, generation) => send({ type: "portrait-failed", characterId, generation })}
        />
      {/key}</span
    >
    <span class="party-order" aria-hidden="true">{member.number || ""}</span
    ><span class="party-candidate-name">{member.name}</span
    ><span class="sr-only party-candidate-state" id={`candidate-state-${index}`}>{member.selectionLabel}</span>
  </button>
  <div class="party-candidate-info">
    <span class="party-candidate-hp" id={`candidate-hp-${index}`}>{member.hp}</span>
    <PartyDetailAction
      name={member.name}
      characterId={member.id}
      onclick={() => send({ type: "show-details", characterId: member.id })}
      onfocus={() => send({ type: "focused", target: { kind: "detail", characterId: member.id } })}
    />
    <span class="party-hp-bar" aria-hidden="true"><i style:width={`${member.ratio * 100}%`}></i></span>
  </div>
  <span class="party-candidate-symptoms" id={`candidate-symptoms-${index}`}>{member.symptoms}</span>
</div>
