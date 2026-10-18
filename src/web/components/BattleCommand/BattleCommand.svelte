<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
export type CommandKind =
  | "attack"
  | "skills"
  | "skill"
  | "use-skill"
  | "cancel-skill"
  | "item"
  | "item-use"
  | "item-back";
let {
  kind,
  enabled = true,
  visible = true,
  selected,
  skillId = "",
  label,
  dispatch,
}: {
  kind: CommandKind;
  enabled?: boolean;
  visible?: boolean;
  selected?: boolean;
  skillId?: string;
  label?: string;
  dispatch: (event: BattleModelEvent) => boolean;
} = $props();
const labels = {
  attack: "通常攻撃",
  skills: "スキル",
  skill: "",
  "use-skill": "使用する",
  "cancel-skill": "戻る",
  item: "",
  "item-use": "使用する",
  "item-back": "戻る",
};
function activate() {
  if (kind === "skill") return dispatch({ type: "select-skill", id: skillId });
  const types = {
    attack: "attack",
    skills: "open-skills",
    "use-skill": "use-skill",
    "cancel-skill": "cancel-skills",
    item: "open-item",
    "item-use": "use-item",
    "item-back": "cancel-item",
  } as const;
  return dispatch({ type: types[kind] });
}
function focus() {
  dispatch({ type: "focused", target: kind === "skill" ? { kind: "skill", id: skillId } : { kind } });
}
</script>
<button
  class="command"
  class:item-trigger={kind === "item"}
  type="button"
  data-attack={kind === "attack" ? "" : undefined}
  data-skills={kind === "skills" ? "" : undefined}
  data-skill-id={kind === "skill" ? skillId : undefined}
  data-use-skill={kind === "use-skill" ? "" : undefined}
  data-cancel-skill={kind === "cancel-skill" ? "" : undefined}
  data-item-use={kind === "item-use" ? "" : undefined}
  data-item-cancel={kind === "item-back" ? "" : undefined}
  data-focus={kind === "skill" ? undefined : kind}
  hidden={!visible}
  disabled={!enabled}
  aria-pressed={selected}
  onclick={activate}
  onfocus={focus}
>
  {#if kind === "attack"}
    <svg class="attack-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11 23 25 5l2 1-3 9-11 11M8 19l9 8M9 25l-5 5M5 26l4 4" />
      <path d="m14 21 8-10" />
    </svg><span>{label ?? labels[kind]}</span>
  {:else}
    {label ?? labels[kind]}
  {/if}
</button>
