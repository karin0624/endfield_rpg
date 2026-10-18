<script lang="ts">
import type { GrowthEvent } from "../../../presentation/growthModel";
import type { GrowthFrame } from "../../../presentation/growthProjection";

let {
  candidate,
  send,
}: {
  candidate: GrowthFrame["candidates"][number];
  send: (event: GrowthEvent) => boolean;
} = $props();
</script>

<button
  type="button"
  class="growth-candidate"
  data-skill-id={candidate.skillId}
  onclick={() => send({ type: "choose", skillId: candidate.skillId })}
  onfocus={() => send({ type: "focused", target: { kind: "candidate", skillId: candidate.skillId } })}
>
  <strong>{candidate.name}</strong><span class="growth-choice-detail">{candidate.detail}</span
  ><span class="growth-choice-detail">{candidate.description}</span>
</button>
