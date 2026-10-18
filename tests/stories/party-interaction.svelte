<script lang="ts">
import type { ComponentProps } from "svelte";
import { type PartyEvent, reduceParty } from "../../src/presentation/partyModel";
import { projectParty } from "../../src/presentation/partyProjection";
import Party from "../../src/web/components/Party.svelte";
import { partyModel } from "./party-model";

let { root, send }: ComponentProps<typeof Party> = $props();
let model = $state(partyModel({ members: 2, edit: true }));
function dispatch(event: PartyEvent) {
  const transition = reduceParty(model, event);
  model = transition.state;
  send(event);
  return transition.handled;
}
</script>

<Party {root} frame={projectParty(model)} send={dispatch} />
