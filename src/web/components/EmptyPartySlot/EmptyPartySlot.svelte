<script lang="ts">
import type { PartyEvent } from "../../../presentation/partyModel";
import "../../party.css";

let { slot, send }: { slot: number; send: (event: PartyEvent) => boolean } = $props();
</script>

<button
  type="button"
  class="party-slot-choice is-empty"
  data-slot={slot}
  aria-label={`枠 ${slot + 1}`}
  {...{ "aria-description": "空き枠。仲間を選択" }}
  onclick={() => send({ type: "open-selection", slot })}
  onfocus={() => send({ type: "focused", target: { kind: "slot", slot } })}
>
  <span class="party-slot-portrait" aria-hidden="true">+</span>
</button>
