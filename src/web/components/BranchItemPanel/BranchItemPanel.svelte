<script lang="ts">
import type { BranchRecoveryEvent } from "../../../presentation/branchRecoveryModel";
import type { DungeonChromeFrame } from "../../../presentation/dungeonProjection";
import "../../items.css";
import BranchItemCancel from "../BranchItemCancel/BranchItemCancel.svelte";
import BranchItemUse from "../BranchItemUse/BranchItemUse.svelte";

let {
  frame,
  send,
}: {
  frame: DungeonChromeFrame["branch"];
  send: (event: BranchRecoveryEvent) => boolean;
} = $props();
</script>

<section class="item-dialog branch-item-dialog" aria-label="HP回復品の使用">
  <h2>HP回復品</h2>
  <p>生存中の味方1人のHPを回復します。精神疲労は増えません。</p>
  <label
    >対象<select
      data-item-target
      data-branch-focus="item-target"
      value={frame.itemTargetId ?? ""}
      onchange={(event) => send({ type: "item-target", id: event.currentTarget.value })}
      onfocus={() => send({ type: "focused", target: { kind: "item-target" } })}
    >
      {#each frame.targets as target (target.id)}
        <option value={target.id}>{target.label}</option>
      {/each}
    </select></label
  >
  <p data-item-preview role="status">{frame.itemPreview}</p>
  <div class="item-actions">
    <BranchItemUse
      disabled={!frame.itemUsable}
      onclick={() => send({ type: "use-item" })}
      onfocus={() => send({ type: "focused", target: { kind: "item-use" } })}
    /><BranchItemCancel
      onclick={() => send({ type: "cancel" })}
      onfocus={() => send({ type: "focused", target: { kind: "cancel" } })}
    />
  </div>
</section>
