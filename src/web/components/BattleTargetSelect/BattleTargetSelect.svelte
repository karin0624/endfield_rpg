<script lang="ts">
import "../../items.css";
import type { BattleModelEvent } from "../../../presentation/battleModel";

let {
  id,
  kind,
  value,
  options,
  dispatch,
}: {
  id?: string;
  kind: "ally-target" | "item-target";
  value: string | null;
  options: readonly { id: string; text: string }[];
  dispatch: (event: BattleModelEvent) => boolean;
} = $props();
</script>
<select
  {id}
  class:battle-ally-target={kind === "ally-target"}
  class:battle-item-target={kind === "item-target"}
  data-ally-target={kind === "ally-target" ? "" : undefined}
  data-item-target={kind === "item-target" ? "" : undefined}
  data-focus={kind}
  aria-label={kind === "ally-target" ? "回復対象" : undefined}
  value={value ?? ""}
  onchange={(event) =>
  dispatch({ type: kind === "ally-target" ? "select-ally" : "select-item-target", id: event.currentTarget.value })}
  onfocus={() => dispatch({ type: "focused", target: { kind } })}
>
  {#each options as member (member.id)}
    <option value={member.id}>{member.text}</option>
  {/each}
</select>
