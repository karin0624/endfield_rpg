<script lang="ts">
import type { CampaignCommand, CampaignEvent } from "../../presentation/campaignModel";
import type { CampaignFrame } from "../../presentation/campaignProjection";
import HubScene from "./HubScene.svelte";

let { root, frame, send }: { root: HTMLElement; frame: CampaignFrame; send: (event: CampaignEvent) => boolean } =
  $props();
let hub = $derived(frame.hub);
let scene: "home" | "town" | "destinations" = $derived(
  frame.kind === "confirm"
    ? (hub?.origin ?? "home")
    : frame.kind === "destinations"
      ? "destinations"
      : frame.kind === "town"
        ? "town"
        : "home",
);
let preparation = $derived(frame.kind === "home" && hub?.panel === "preparation");
let modal = $derived(frame.kind === "confirm" || hub?.panel === "menu" || hub?.panel === "title-options");
let waiting = $derived(frame.kind === "confirm" && frame.waiting);
let focused = $derived(frame.focus);
const command = (id: string) => send({ type: "command", command: id as CampaignCommand });
function focus(id: string) {
  if (scene === "town" && hub?.places.some((place) => place.id === id))
    send({ type: "town", event: { type: "focused", target: { kind: "place", placeId: id } } });
  else send({ type: "focused", target: { kind: "command", command: id } });
}
$effect(() => {
  const target = focused;
  let selector =
    target?.kind === "command"
      ? `[data-command="${target.command}"]`
      : target?.kind === "carry"
        ? ".item-carry-input"
        : target?.kind === "town-place"
          ? `[data-place-id="${CSS.escape(target.placeId)}"]`
          : scene === "destinations"
            ? '[data-command="town"]'
            : scene === "town"
              ? ".locations button"
              : '[data-command="equipment"]';
  const node = root.querySelector<HTMLElement>(selector);
  if (node && node !== document.activeElement) node.focus({ preventScroll: true });
});
function trap(event: KeyboardEvent) {
  if (event.key !== "Tab" || !modal) return;
  const controls = [...root.querySelectorAll<HTMLElement>(".hub-dialog button:not(:disabled)")];
  const i = controls.indexOf(document.activeElement as HTMLElement);
  event.preventDefault();
  controls[
    i < 0
      ? event.shiftKey
        ? controls.length - 1
        : 0
      : (i + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
  ]?.focus();
}
</script>
<svelte:window onkeydown={trap} />
{#if hub}
  <HubScene
    {scene}
    calendar={frame.calendar}
    feedback={frame.kind === "home" ? [...hub.feedback, ...(frame.status ? [frame.status] : [])] : hub.feedback}
    places={hub.places}
    {command}
    select={(placeId: string) => send({ type: "town", event: { type: "select", placeId } })}
    focused={focus}
    {modal}
    hideControls={preparation}
  >
    {#if preparation}
      <div class="prep-wrap">
        <h1>出かける準備</h1>
        <section class="prep-panel">
          <div class="item-row">
            <div>
              HP回復品
              <div>HPを8回復</div>
            </div>
            <span>保管 {hub.carry.stock}個</span>
          </div>
          <div class="quantity">
            <label
              >持込む個数<span class="item-number-control item-carry-control"
                ><input
                  class="item-carry-input"
                  required
                  aria-label="HP回復品の持込み個数"
                  type="number"
                  min="0"
                  max={hub.carry.stock}
                  step="1"
                  value={hub.carry.quantity ?? ""}
                  oninput={(e) =>
  send({
    type: "carry-changed",
    quantity: Number.isNaN(e.currentTarget.valueAsNumber) ? null : e.currentTarget.valueAsNumber,
  })}
                  onfocus={() => send({ type: "focused", target: { kind: "carry" } })}
                ></span
              ></label
            >
          </div>
        </section>
        <div class="footer">
          {#each [
   ["equipment", "装備を整える"],
   ["edit-party", "編成を確認"],
   ["destinations", "行き先へ"],
   ["close-panel", "ホームへ戻る"],
 ] as [id, label]}
            <button
              type="button"
              class="ui-action"
              data-command={id}
              onclick={() => command(id)}
              onfocus={() => focus(id)}
            >
              {label}
            </button>
          {/each}
        </div>
      </div>
    {:else if modal}
      <button
        type="button"
        class="veil"
        tabindex="-1"
        aria-label="メニューの外側"
        onclick={() => {
  if (hub.panel === "menu") command("close-panel");
}}
      ></button>
      <div
        class="hub-dialog"
        class:command={hub.panel === "menu"}
        role="dialog"
        aria-modal="true"
        aria-label={hub.panel === "menu"
  ? "メニュー"
  : hub.panel === "title-options"
    ? "タイトルへ戻りますか"
    : hub.confirmation === "title"
      ? "未保存の変更を破棄しますか"
      : waiting
        ? "保存しています…"
        : "上書き保存しますか"}
      >
        {#if hub.panel === "menu"}
          <button
            type="button"
            class="ui-action icon-button"
            data-command="close-panel"
            aria-label="メニューを閉じる"
            onclick={() => command("close-panel")}
            onfocus={() => focus("close-panel")}
          >
            <svg class="ui-glyph" viewBox="4 4 16 16" aria-hidden="true"><path d="M5 5L19 19M19 5L5 19" /></svg>
          </button>
          <div class="stack">
            <button
              type="button"
              class="ui-action"
              data-command="save"
              disabled={scene === "town"}
              aria-describedby={scene === "town" ? "hub-save-reason" : undefined}
              onclick={() => command("save")}
              onfocus={() => focus("save")}
            >
              保存
            </button>
            {#if scene === "town"}
              <p id="hub-save-reason">保存はホームで行えます。</p>
            {/if}
            <button
              type="button"
              class="ui-action"
              data-command="title-options"
              onclick={() => command("title-options")}
              onfocus={() => focus("title-options")}
            >
              タイトルへ
            </button>
          </div>
        {:else if hub.panel === "title-options"}
          <h2>タイトルへ戻りますか</h2>
          <p>未保存の変更は失われます。</p>
          <div class="stack">
            {#if scene === "town"}
              <p>保存はホームで行えます。</p>
            {/if}
            {#each [
   ["save-title", "保存してタイトルへ"],
   ["title", "保存せずタイトルへ"],
   ["close-panel", "取り消す"],
 ] as [id, label]}
              <button
                type="button"
                class="ui-action"
                data-command={id}
                disabled={scene === "town" && id === "save-title"}
                onclick={() => command(id)}
                onfocus={() => focus(id)}
              >
                {label}
              </button>
            {/each}
          </div>
        {:else}
          <h2>
            {hub.confirmation === "title" ? "未保存の変更を破棄しますか" : waiting ? "保存しています…" : "上書き保存しますか"}
          </h2>
          <div class="buttons">
            <button
              type="button"
              class="ui-action"
              data-command="cancel"
              disabled={waiting}
              onclick={() => command("cancel")}
              onfocus={() => focus("cancel")}
            >
              取り消す
            </button>
            <button
              type="button"
              class="ui-action primary"
              data-command="accept"
              disabled={waiting}
              onclick={() => command("accept")}
              onfocus={() => focus("accept")}
            >
              {hub.confirmation === "title" ? "タイトルへ戻る" : "保存"}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </HubScene>
{/if}
