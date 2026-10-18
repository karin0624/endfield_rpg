<script lang="ts">
import type { AdventureFrame } from "../../presentation/adventureProjection";

let { type, speaker, text }: Pick<NonNullable<AdventureFrame["scene"]>, "type" | "speaker" | "text"> = $props();
</script>

<div class="dialogue-panel" data-dialogue-panel aria-live="polite">
  <div class="dialogue-speaker" data-speaker>{speaker}</div>
  <div class="dialogue-divider"></div>
  <p class="dialogue-text" data-dialogue-text>{text}</p>
  <span class="dialogue-next" data-dialogue-next aria-hidden="true" hidden={type !== "line"}></span>
</div>
