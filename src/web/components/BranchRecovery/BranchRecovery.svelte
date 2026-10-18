<script lang="ts">
import type { BranchFocus, BranchRecoveryEvent } from "../../../presentation/branchRecoveryModel";
import type { DungeonChromeFrame } from "../../../presentation/dungeonProjection";
import BranchItemDialog from "../BranchItemDialog/BranchItemDialog.svelte";
import BranchItemTrigger from "../BranchItemTrigger/BranchItemTrigger.svelte";
import BranchSkillDialog from "../BranchSkillDialog/BranchSkillDialog.svelte";
import BranchSkillTrigger from "../BranchSkillTrigger/BranchSkillTrigger.svelte";

let {
  root,
  frame,
  result,
  send,
}: {
  root: HTMLElement;
  frame: DungeonChromeFrame["branch"];
  result: string;
  send: (event: BranchRecoveryEvent) => boolean;
} = $props();
const focused = (target: BranchFocus) => send({ type: "focused", target });
$effect(() => {
  const focus = frame.focus;
  frame.buttons;
  if (!focus) return;
  const selector =
    focus.kind === "cancel"
      ? `${frame.panel === "item" ? ".item-dialog" : ".branch-skill-dialog"} [data-branch-focus="cancel"]`
      : "id" in focus
        ? `[data-branch-focus="${focus.kind}"][data-id="${CSS.escape(focus.id)}"]`
        : `[data-branch-focus="${focus.kind}"]`;
  const node = root.querySelector<HTMLElement>(selector);
  if (node && node !== document.activeElement) node.focus();
});
</script>

<div class="branch-skill-trigger-position" hidden={!frame.skillVisible}>
  <BranchSkillTrigger onclick={() => send({ type: "open-skill" })} onfocus={() => focused({ kind: "skill-trigger" })} />
</div>
<BranchSkillDialog {frame} {send} open={frame.panel === "skill"} />
<div class="item-trigger-position" hidden={!frame.itemVisible}>
  <BranchItemTrigger
    label={frame.itemLabel}
    disabled={!frame.itemAvailable}
    onclick={() => send({ type: "open-item" })}
    onfocus={() => focused({ kind: "item-trigger" })}
  />
</div>
<BranchItemDialog {frame} {send} open={frame.panel === "item"} />
<p class="branch-skill-result" role="status">{result}</p>
