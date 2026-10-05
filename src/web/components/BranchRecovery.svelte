<script lang="ts">
import { onDestroy } from "svelte";
import type { BranchFocus, BranchRecoveryEvent } from "../../presentation/branchRecoveryModel";
import type { DungeonChromeFrame } from "../../presentation/dungeonProjection";

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
let skill: HTMLDialogElement, item: HTMLDialogElement;
const focused = (target: BranchFocus) => send({ type: "focused", target });
$effect(() => {
  if (frame.panel !== "skill" && skill.open) skill.close();
  if (frame.panel !== "item" && item.open) item.close();
  if (frame.panel === "skill" && !skill.open) skill.showModal();
  if (frame.panel === "item" && !item.open) item.showModal();
});
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
function key(event: KeyboardEvent) {
  if (send({ type: "key", key: event.key, shift: event.shiftKey })) event.preventDefault();
  event.stopPropagation();
}
function cancel(event: Event) {
  event.preventDefault();
  send({ type: "cancel" });
}
onDestroy(() => {
  if (skill?.open) skill.close();
  if (item?.open) item.close();
});
</script>
<button
  type="button"
  class="branch-skill-trigger"
  data-branch-focus="skill-trigger"
  hidden={!frame.skillVisible}
  onclick={() => send({ type: "open-skill" })}
  onfocus={() => focused({ kind: "skill-trigger" })}
>
  分岐で回復
</button>
<dialog class="branch-skill-dialog" aria-label="分岐の回復スキル" bind:this={skill} oncancel={cancel} onkeydown={key}>
  <h2>{frame.title}</h2>
  {#each frame.buttons as button (`${button.event.type}:${button.event.id}`)}
    <button
      type="button"
      data-branch-focus={button.focus.kind}
      data-id={button.focus.id}
      onclick={() => send(button.event)}
      onfocus={() => focused(button.focus)}
    >
      {button.label}
    </button>
    {#if button.description}
      <p>{button.description}</p>
    {/if}
  {/each}
  {#if !frame.buttons.length}
    <p>{frame.empty}</p>
  {/if}
  <button
    type="button"
    data-branch-focus="cancel"
    onclick={() => send({ type: "cancel" })}
    onfocus={() => focused({ kind: "cancel" })}
  >
    取消
  </button>
</dialog>
<button
  type="button"
  class="command item-trigger"
  data-branch-focus="item-trigger"
  hidden={!frame.itemVisible}
  disabled={!frame.itemAvailable}
  onclick={() => send({ type: "open-item" })}
  onfocus={() => focused({ kind: "item-trigger" })}
>
  {frame.itemLabel}
</button>
<dialog class="item-dialog" aria-label="HP回復品の使用" bind:this={item} oncancel={cancel} onkeydown={key}>
  <h2>HP回復品</h2>
  <p>生存中の味方1人のHPを回復します。精神疲労は増えません。</p>
  <label
    >対象<select
      data-item-target
      data-branch-focus="item-target"
      value={frame.itemTargetId ?? ""}
      onchange={(event) => send({ type: "item-target", id: event.currentTarget.value })}
      onfocus={() => focused({ kind: "item-target" })}
    >
      {#each frame.targets as target (target.id)}
        <option value={target.id}>{target.label}</option>
      {/each}
    </select></label
  >
  <p data-item-preview role="status">{frame.itemPreview}</p>
  <div class="item-actions">
    <button
      type="button"
      class="command"
      data-item-use
      data-branch-focus="item-use"
      disabled={!frame.itemUsable}
      onclick={() => send({ type: "use-item" })}
      onfocus={() => focused({ kind: "item-use" })}
    >
      使用する
    </button><button
      type="button"
      class="command"
      data-item-cancel
      data-branch-focus="cancel"
      onclick={() => send({ type: "cancel" })}
      onfocus={() => focused({ kind: "cancel" })}
    >
      戻る
    </button>
  </div>
</dialog>
<p class="branch-skill-result" role="status">{result}</p>
