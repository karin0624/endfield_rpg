<script lang="ts">
import type { PartyEvent } from "../../../presentation/partyModel";
import type { PartyFrame } from "../../../presentation/partyProjection";
import EmptyPartySlot from "../EmptyPartySlot/EmptyPartySlot.svelte";
import Portrait from "../Portrait/Portrait.svelte";
import "../../party.css";

let {
  slot,
  member,
  portraitGeneration = 0,
  send,
}: {
  slot: number;
  member: PartyFrame["slots"][number]["member"];
  portraitGeneration?: number;
  send: (event: PartyEvent) => boolean;
} = $props();
</script>

<div class="party-slot" class:is-occupied={member !== null}>
  {#if member}
    <button
      type="button"
      class="party-slot-choice"
      data-slot={slot}
      aria-label={`枠 ${slot + 1}`}
      {...{ "aria-description": `${member.name} ${member.hp} ${member.symptoms}` }}
      onclick={() => send({ type: "open-selection", slot })}
      onfocus={() => send({ type: "focused", target: { kind: "slot", slot } })}
    >
      <span class="party-slot-portrait" aria-hidden="true"
        >{#key `${portraitGeneration}:${member.id}`}
          <Portrait
            path={member.portrait}
            characterId={member.id}
            generation={portraitGeneration}
            imageClass="party-character-image"
            failed={(characterId, generation) => send({ type: "portrait-failed", characterId, generation })}
          />
        {/key}</span
      >
      <span class="party-slot-name">{member.name}</span
      ><span class="party-hp-bar" aria-hidden="true"><i style:width={`${member.ratio * 100}%`}></i></span
      ><span class="party-slot-hp">{member.hp}</span><span class="party-slot-symptoms">{member.symptoms}</span>
    </button>
  {:else}
    <EmptyPartySlot {slot} {send} />
  {/if}
</div>
