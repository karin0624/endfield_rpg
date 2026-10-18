<script lang="ts">
import type { ComponentProps } from "svelte";
import { partyModel } from "../../../../.storybook/fixtures/party-model";
import { type PartyEvent, reduceParty } from "../../../presentation/partyModel";
import { projectParty } from "../../../presentation/partyProjection";
import Party from "./Party.svelte";

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
