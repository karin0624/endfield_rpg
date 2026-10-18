<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";
import "../../campaign.css";

let {
  primary = false,
  label,
  class: className = "",
  ...attributes
}: HTMLButtonAttributes & { primary?: boolean; label: string } = $props();
</script>

<button
  type="button"
  {...attributes}
  class={`campaign-command${primary ? " is-primary" : ""}${className ? ` ${className}` : ""}`}
>
  {label}
</button>
