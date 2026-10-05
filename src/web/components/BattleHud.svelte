<script lang="ts">
import { onDestroy, onMount } from "svelte";
import type { BattleFocus, BattleModelEvent } from "../../presentation/battleModel";
import { projectPartyOverflow } from "../../presentation/battlePlacement";
import type { BattleHudFrame } from "../../presentation/battleViewProjection";
import "../items.css";

let {
  frame,
  board,
  dispatch,
}: { frame: BattleHudFrame; board: HTMLElement; dispatch: (event: BattleModelEvent) => boolean } = $props();
let ui: HTMLDivElement, party: HTMLElement, dialog: HTMLDialogElement;
let focus = $derived(frame.focus),
  anchor = $derived(frame.partyAnchor),
  allies = $derived(frame.allies),
  skillBattle = $derived(frame.skillBattle);
const focused = (target: BattleFocus) => dispatch({ type: "focused", target });
$effect(() => {
  if (frame.items.open && !dialog.open) dialog.showModal();
  else if (!frame.items.open && dialog.open) dialog.close();
});
$effect(() => {
  if (!focus) return;
  const selector =
    focus.kind === "enemy"
      ? `[data-combatant-id="${CSS.escape(focus.id)}"]`
      : focus.kind === "skill"
        ? `[data-skill-id="${CSS.escape(focus.id)}"]`
        : focus.kind === "symptom"
          ? `[data-ally-id="${CSS.escape(focus.id)}"] [data-symptom="${focus.symptom}"] summary`
          : `[data-focus="${focus.kind}"]`;
  const node = board.querySelector<HTMLElement>(selector);
  if (node && node !== document.activeElement) node.focus();
});
function clearAnchor() {
  party.style.removeProperty("height");
  party.style.removeProperty("align-items");
  for (const card of party.querySelectorAll<HTMLElement>(".ally-card")) card.style.removeProperty("min-height");
}
function applyAnchor() {
  clearAnchor();
  const cards = [...party.querySelectorAll<HTMLElement>(".ally-card")];
  if (anchor) {
    party.style.height = `${anchor.height}px`;
    party.style.alignItems = "flex-start";
    for (const card of cards) card.style.minHeight = `${anchor.height}px`;
  }
  ui.toggleAttribute(
    "data-party-overflow",
    projectPartyOverflow(
      anchor !== null,
      board.getBoundingClientRect().bottom,
      cards.map((card) => card.getBoundingClientRect().bottom),
    ),
  );
}
export function measure() {
  if (!skillBattle) return;
  clearAnchor();
  const style = getComputedStyle(party),
    rect = party.getBoundingClientRect();
  const result = {
    absolute: style.position === "absolute",
    width: rect.width,
    height: rect.height,
    font: style.fontSize,
  };
  applyAnchor();
  return result;
}
$effect(() => {
  anchor;
  allies;
  skillBattle;
  if (skillBattle) applyAnchor();
});
$effect(() => {
  allies;
  skillBattle;
  const observer = new ResizeObserver(() => {
    const result = measure();
    if (result) dispatch({ type: "party-measured", measure: result });
  });
  observer.observe(board);
  for (const details of party.querySelectorAll(".ally-details")) observer.observe(details);
  return () => observer.disconnect();
});
onMount(() => {
  const key = (event: KeyboardEvent) => {
    if (dispatch({ type: "key", key: event.key, shift: event.shiftKey })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  board.addEventListener("keydown", key);
  return () => board.removeEventListener("keydown", key);
});
onDestroy(() => {
  if (dialog?.open) dialog.close();
});
</script>
<div
  class="battle-ui"
  data-battle-ui
  data-skill-battle={frame.skillBattle ? "" : undefined}
  class:with-skills={frame.skillBattle}
  bind:this={ui}
>
  <section class="timeline panel" aria-label="行動順">
    <ol class="queue" data-timeline aria-label="行動順。数値は次の行動までの整数tick">
      <!-- Forecast entries can repeat combatant IDs; list positions identify its six slots. -->
      {#each frame.queue as member}
        <li
          class="queue-row"
          class:current={member.current}
          class:enemy={member.enemy}
          aria-current={member.current ? "step" : undefined}
          aria-label={member.label}
        >
          <span class="queue-portrait"><img alt="" src={`${import.meta.env.BASE_URL}assets/${member.portrait}`}></span
          ><span class="queue-name">{member.name}</span>
          {#if !member.current}
            <span class="queue-value"><b>{member.ticks}</b></span>
          {/if}
        </li>
      {/each}
    </ol>
  </section>
  <section class="commands panel" aria-labelledby="command-title">
    <h2 id="command-title">行動を選択</h2>
    <button
      class="command"
      type="button"
      data-attack
      data-focus="attack"
      hidden={!frame.attack.visible}
      disabled={!frame.attack.enabled}
      onclick={() => dispatch({ type: "attack" })}
      onfocus={() => focused({ kind: "attack" })}
    >
      <svg class="attack-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M11 23 25 5l2 1-3 9-11 11M8 19l9 8M9 25l-5 5M5 26l4 4" />
        <path d="m14 21 8-10" />
      </svg><span>通常攻撃</span>
    </button>
    <button
      class="command"
      type="button"
      data-skills
      data-focus="skills"
      hidden={!frame.skills.triggerVisible}
      disabled={!frame.skills.enabled}
      onclick={() => dispatch({ type: "open-skills" })}
      onfocus={() => focused({ kind: "skills" })}
    >
      スキル
    </button>
    <div class="skill-panel" data-skill-panel hidden={!frame.skills.visible}>
      <p data-skill-fatigue>{frame.skills.fatigue}</p>
      <div data-skill-list>
        {#each frame.skills.choices as choice (choice.id)}
          <button
            type="button"
            class="command"
            data-skill-id={choice.id}
            aria-pressed={choice.selected}
            onclick={() => dispatch({ type: "select-skill", id: choice.id })}
            onfocus={() => focused({ kind: "skill", id: choice.id })}
          >
            {choice.text}
          </button>
        {/each}
      </div>
      <p data-skill-preview>{frame.skills.preview}</p>
      <label data-ally-label hidden={!frame.skills.allyTargetVisible}
        >回復対象<select
          data-ally-target
          data-focus="ally-target"
          aria-label="回復対象"
          value={frame.skills.allyTargetId ?? ""}
          onchange={(event) => dispatch({ type: "select-ally", id: event.currentTarget.value })}
          onfocus={() => focused({ kind: "ally-target" })}
        >
          {#each frame.skills.allies as member (member.id)}
            <option value={member.id}>{member.text}</option>
          {/each}
        </select></label
      >
      <button
        class="command"
        type="button"
        data-use-skill
        data-focus="use-skill"
        disabled={!frame.skills.useEnabled}
        onclick={() => dispatch({ type: "use-skill" })}
        onfocus={() => focused({ kind: "use-skill" })}
      >
        使用する
      </button><button
        class="command"
        type="button"
        data-cancel-skill
        data-focus="cancel-skill"
        onclick={() => dispatch({ type: "cancel-skills" })}
        onfocus={() => focused({ kind: "cancel-skill" })}
      >
        戻る
      </button>
    </div>
    <p class="skill-result" data-skill-result hidden={!frame.summary.visible}>{frame.summary.text}</p>
    <div class="sequence-controls" hidden={!frame.controls.visible}>
      <label
        >演出
        <select
          data-sequence-speed
          data-focus="speed"
          aria-label="演出速度"
          value={String(frame.controls.speed)}
          onchange={(event) =>
  dispatch({ type: "playback", event: { type: "speed", speed: Number(event.currentTarget.value) as 0 | 1 | 2 } })}
          onfocus={() => focused({ kind: "speed" })}
        >
          <option value="1">1倍</option>
          <option value="2">2倍</option>
          <option value="0">即時</option>
        </select></label
      ><button
        type="button"
        data-sequence-skip
        data-focus="skip"
        hidden={!frame.controls.skip}
        onclick={() => dispatch({ type: "playback", event: { type: "skip" } })}
        onfocus={() => focused({ kind: "skip" })}
      >
        演出を省略
      </button>
    </div>
    <button
      type="button"
      class="command item-trigger"
      data-focus="item"
      hidden={!frame.items.visible}
      disabled={!frame.items.enabled}
      onclick={() => dispatch({ type: "open-item" })}
      onfocus={() => focused({ kind: "item" })}
    >
      {frame.items.label}
    </button>
    <dialog
      class="item-dialog"
      aria-label="HP回復品の使用"
      bind:this={dialog}
      oncancel={(event) => {
  event.preventDefault();
  dispatch({ type: "cancel-item" });
}}
    >
      <h2>HP回復品</h2>
      <p>生存中の味方1人のHPを回復します。精神疲労は増えません。</p>
      <label
        >対象<select
          data-item-target
          data-focus="item-target"
          value={frame.items.targetId ?? ""}
          onchange={(event) => dispatch({ type: "select-item-target", id: event.currentTarget.value })}
          onfocus={() => focused({ kind: "item-target" })}
        >
          {#each frame.items.targets as member (member.id)}
            <option value={member.id}>{member.text}</option>
          {/each}
        </select></label
      >
      <p data-item-preview role="status">{frame.items.preview}</p>
      <div class="item-actions">
        <button
          type="button"
          class="command"
          data-item-use
          data-focus="item-use"
          disabled={!frame.items.useEnabled}
          onclick={() => dispatch({ type: "use-item" })}
          onfocus={() => focused({ kind: "item-use" })}
        >
          使用する
        </button><button
          type="button"
          class="command"
          data-item-cancel
          data-focus="item-back"
          onclick={() => dispatch({ type: "cancel-item" })}
          onfocus={() => focused({ kind: "item-back" })}
        >
          戻る
        </button>
      </div>
    </dialog>
  </section>
  <section class="party" data-party aria-label="味方の状態" bind:this={party}>
    {#each frame.allies as member (member.id)}
      <article
        class="ally-card"
        class:active={member.active}
        class:defeated={member.defeated}
        data-ally-id={member.id}
        aria-current={member.active ? "true" : undefined}
        aria-label={member.label}
      >
        <img class="ally-portrait" alt="" src={`${import.meta.env.BASE_URL}assets/${member.portrait}`}>
        <div class="ally-details">
          <div class="ally-heading"><strong>{member.name}</strong><span class="ally-status">{member.status}</span></div>
          <div class="hp-line"><span>HP</span><b>{member.hp}</b><span>/ {member.maximum}</span></div>
          <span class="hp-track" aria-hidden="true"><span style:width={`${member.fraction * 100}%`}></span></span>
          <div class="symptom-icons" hidden={!member.symptoms.length}>
            {#each member.symptoms as symptom (symptom.kind)}
              <details class="symptom-icon" data-symptom={symptom.kind} open={symptom.open}>
                <!-- biome-ignore lint/a11y/noStaticElementInteractions: Native summary controls a details disclosure through the synchronous model. -->
                <summary
                  onclick={(event) => {
  event.preventDefault();
  dispatch({ type: "toggle-symptom", id: member.id, symptom: symptom.kind });
}}
                  onfocus={() => focused({ kind: "symptom", id: member.id, symptom: symptom.kind })}
                >
                  <span class="symptom-mark" aria-hidden="true">{symptom.icon}</span><span>{symptom.label}</span>
                </summary>
                <span class="symptom-description">{symptom.detail}</span>
              </details>
            {/each}
          </div>
        </div>
      </article>
    {/each}
  </section>
  <section class="battle-result panel" data-result role="status" aria-live="assertive" hidden={!frame.result.visible}>
    <h2 data-result-title>{frame.result.title}</h2>
    <p data-result-detail>{frame.result.detail}</p>
    <button
      type="button"
      class="primary"
      data-rematch
      data-focus="finish"
      hidden={!frame.result.visible}
      aria-label={frame.result.finishAriaLabel}
      onclick={() => dispatch({ type: "finish" })}
      onfocus={() => focused({ kind: "finish" })}
    >
      {frame.result.finishLabel}
    </button>
  </section>
</div>
<p class="sr-only" id="battle-screen-reader-status" data-screen-reader-status role="status" aria-live="polite">
  {frame.announcement}
</p>
