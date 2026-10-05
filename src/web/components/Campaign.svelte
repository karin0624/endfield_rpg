<script lang="ts">
import { onMount } from "svelte";
import { parseAdventureSettings } from "../../presentation/adventureSettings";
import type { CampaignEvent } from "../../presentation/campaignModel";
import type { CampaignFrame } from "../../presentation/campaignProjection";
import savedAdventureSettings from "../adventure-settings.json";
import Adventure from "./Adventure.svelte";
import GrowthChoice from "./GrowthChoice.svelte";
import Party from "./Party.svelte";
import "../campaign.css";
import "../items.css";

let { root, frame, send }: { root: HTMLElement; frame: CampaignFrame | null; send: (event: CampaignEvent) => boolean } =
  $props();
let partyRoot = $state<HTMLElement>();
let focus = $derived(frame?.focus);
const settings = parseAdventureSettings(savedAdventureSettings);
$effect(() => {
  if (!focus || frame?.kind === "town" || frame?.kind === "growth") return;
  const selector =
    focus.kind === "heading"
      ? ".campaign-header h1"
      : focus.kind === "command"
        ? `[data-command="${focus.command}"]`
        : focus.kind === "carry"
          ? ".item-carry-input"
          : focus.kind === "equipment"
            ? `[data-character="${CSS.escape(focus.characterId)}"][data-slot="${focus.slot}"]`
            : null;
  const node = selector ? root.querySelector<HTMLElement>(selector) : null;
  if (node && node !== document.activeElement) node.focus();
});
onMount(() => {
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape" && send({ type: "escape" })) event.preventDefault();
  };
  window.addEventListener("keydown", key);
  return () => {
    window.removeEventListener("keydown", key);
    document.body.classList.remove("dungeon-mode");
  };
});
</script>
{#if frame && frame.kind !== "disposed" && frame.kind !== "dungeon"}
  {#if frame.kind === "town"}
    <Adventure
      {root}
      frame={frame.town.adventure}
      utilities={frame.town.adventure.utilities}
      {settings}
      send={(event) => send({ type: "town", event })}
      shop={frame.town.shop}
      shopSend={(event) => send({ type: "town", event })}
    />
  {:else if frame.kind === "growth"}
    {#if frame.growth}
      <GrowthChoice
        frame={frame.growth}
        focus={frame.focus?.kind === "growth-heading"
  ? { kind: "heading" }
  : frame.focus?.kind === "growth-candidate"
    ? { kind: "candidate", skillId: frame.focus.skillId }
    : null}
        send={(event) => send({ type: "growth", event })}
      />
    {/if}
  {:else}
    <main class="campaign-screen" data-campaign-screen={frame.kind}>
      <div class="campaign-art" aria-hidden="true">
        {#if frame.kind === "home"}
          <img src={`${import.meta.env.BASE_URL}assets/${frame.portrait.path}`} alt="">
        {/if}
      </div>
      <header class="campaign-header">
        <h1 tabindex="-1" onfocus={() => send({ type: "focused", target: { kind: "heading" } })}>{frame.title}</h1>
        <p data-calendar>{frame.calendar}</p>
      </header>
      <section class="campaign-content">
        {#if frame.kind === "party"}
          <section class="party-editor" bind:this={partyRoot}>
            {#if partyRoot}
              <Party root={partyRoot} frame={frame.party} send={(event) => send({ type: "party", event })} />
            {/if}
          </section>
        {:else}
          <div class="campaign-copy">
            {#if frame.kind === "home"}
              <div data-town-recovery class="campaign-report" role="status" hidden={!frame.feedback.length}>
                {#each frame.feedback as text}
                  <p>{text}</p>
                {/each}
              </div>
            {/if}
            {#each frame.copy as text}
              <p>{text}</p>
            {/each}
            {#if frame.kind === "home"}
              <label
                >持込み個数（HP回復品）<input
                  type="number"
                  min="0"
                  max={frame.carry.stock}
                  step="1"
                  class="item-carry-input"
                  value={frame.carry.quantity ?? ""}
                  oninput={(event) =>
  send({
    type: "carry-changed",
    quantity: Number.isNaN(event.currentTarget.valueAsNumber) ? null : event.currentTarget.valueAsNumber,
  })}
                  onfocus={() => send({ type: "focused", target: { kind: "carry" } })}
                ></label
              >
            {:else if frame.kind === "equipment"}
              {#each frame.members as member (member.id)}
                <p>{member.summary}</p>
                {#each member.slots as field (field.slot)}
                  <label
                    >{field.label}<select
                      class="item-equipment-select"
                      data-character={member.id}
                      data-slot={field.slot}
                      value={field.selected}
                      onchange={(event) =>
  send({ type: "equip", characterId: member.id, slot: field.slot, instanceId: event.currentTarget.value || null })}
                      onfocus={() => send({ type: "focused", target: { kind: "equipment", characterId: member.id, slot: field.slot } })}
                    >
                      {#each field.options as option (option.value)}
                        <option value={option.value} disabled={option.disabled}>{option.label}</option>
                      {/each}
                    </select></label
                  >
                {/each}
              {/each}
            {/if}
          </div>
          <nav class="campaign-commands" aria-label={frame.title}>
            {#each frame.commands as command (command.command)}
              <button
                type="button"
                class="campaign-command"
                class:is-primary={command.primary}
                data-command={command.command}
                disabled={"waiting" in frame && frame.waiting}
                onclick={() => send({ type: "command", command: command.command })}
                onfocus={() => send({ type: "focused", target: { kind: "command", command: command.command } })}
              >
                {command.label}
              </button>
            {/each}
          </nav>
          <p class="campaign-status" role="status">{frame.status}</p>
        {/if}
      </section>
    </main>
  {/if}
{/if}
