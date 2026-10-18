<script lang="ts">
import type { BranchRecoveryEvent } from "../../presentation/branchRecoveryModel";
import type { DungeonChromeFrame } from "../../presentation/dungeonProjection";
import BranchSkillButton from "./BranchSkillButton.svelte";

let {
  frame,
  send,
}: {
  frame: DungeonChromeFrame["branch"];
  send: (event: BranchRecoveryEvent) => boolean;
} = $props();
</script>

<section class="branch-skill-dialog" aria-label="分岐の回復スキル">
  <h2>{frame.title}</h2>
  {#each frame.buttons as button (`${button.event.type}:${button.event.id}`)}
    <BranchSkillButton
      label={button.label}
      data-branch-focus={button.focus.kind}
      data-id={button.focus.id}
      onclick={() => send(button.event)}
      onfocus={() => send({ type: "focused", target: button.focus })}
    />
    {#if button.description}
      <p>{button.description}</p>
    {/if}
  {/each}
  {#if !frame.buttons.length}
    <p>{frame.empty}</p>
  {/if}
  <BranchSkillButton
    label="取消"
    data-branch-focus="cancel"
    onclick={() => send({ type: "cancel" })}
    onfocus={() => send({ type: "focused", target: { kind: "cancel" } })}
  />
</section>
