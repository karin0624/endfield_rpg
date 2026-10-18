<script lang="ts">
import type { HTMLButtonAttributes } from "svelte/elements";
import UiButton from "../UiButton/UiButton.svelte";
import "../../party.css";

let { action, ...attributes }: HTMLButtonAttributes & { action: "back" | "depart" | "confirm" } = $props();
</script>

<UiButton
  {...attributes}
  kind={action === "back" ? "back" : "primary"}
  class={`party-footer-action party-${action}${action === "confirm" ? " party-confirm" : ""}`}
  label={action === "back" ? "戻る" : action === "depart" ? "出発する" : "確定"}
/>
