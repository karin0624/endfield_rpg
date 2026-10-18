<script lang="ts">
import type { AdventureFrame } from "../../../presentation/adventureProjection";

let {
  option,
  choose,
  focused,
}: {
  option: NonNullable<AdventureFrame["scene"]>["choices"][number];
  choose: (id: string) => void;
  focused: (id: string) => void;
} = $props();
</script>

<button
  type="button"
  class="conversation-choice"
  data-option-id={option.id}
  onclick={(event) => {
  event.stopPropagation();
  choose(option.id);
}}
  onfocus={() => focused(option.id)}
>
  <svg class="choice-tetrahedron" viewBox="0 0 32 32" aria-hidden="true">
    <polygon points="30,16 4,3 4,29" fill="#394438" stroke="#f0b84a" stroke-width="1.5" />
    <path d="M30 16H4M4 3l12 13L4 29" fill="none" stroke="#f0b84a" stroke-width="1.2" />
  </svg><span class="choice-number">{option.number}</span><span class="choice-label">{option.label}</span>
</button>
