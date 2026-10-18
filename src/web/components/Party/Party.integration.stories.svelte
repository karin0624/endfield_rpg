<script lang="ts">
import { type PartyEvent, type PartyModel, reduceParty } from "../../../presentation/partyModel";
import { projectParty } from "../../../presentation/partyProjection";
import Party from "./Party.svelte";

let { root, model, send }: { root?: HTMLElement; model: PartyModel; send: (event: PartyEvent) => boolean } = $props();
function dispatch(event: PartyEvent) {
  const transition = reduceParty(model, event);
  model = transition.state;
  send(event);
  return transition.handled;
}
</script>

<Party {root} frame={projectParty(model)} send={dispatch} />
