<script lang="ts">
import type { CampaignCommand, CampaignEvent } from "../../../presentation/campaignModel";
import type { CampaignFrame } from "../../../presentation/campaignProjection";
import CarryInput from "../CarryInput/CarryInput.svelte";
import HubAction from "../HubAction/HubAction.svelte";
import HubDialog from "../HubDialog/HubDialog.svelte";
import HubScene from "../HubScene/HubScene.svelte";

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
            <label for="preparation-carry-quantity"
              >持込む個数<CarryInput
                id="preparation-carry-quantity"
                required
                aria-label="HP回復品の持込み個数"
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
              /></label
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
            <HubAction type="button" data-command={id} onclick={() => command(id)} onfocus={() => focus(id)}>
              {label}
            </HubAction>
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
      <HubDialog panel={hub.panel} confirmation={hub.confirmation} {scene} {waiting} {command} focused={focus} />
    {/if}
  </HubScene>
{/if}
