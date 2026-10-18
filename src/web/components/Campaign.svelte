<script lang="ts">
import { onMount } from "svelte";
import { parseAdventureSettings } from "../../presentation/adventureSettings";
import type { CampaignEvent } from "../../presentation/campaignModel";
import type { CampaignFrame } from "../../presentation/campaignProjection";
import savedAdventureSettings from "../adventure-settings.json";
import Adventure from "./Adventure.svelte";
import CampaignCommand from "./CampaignCommand.svelte";
import CampaignHub from "./CampaignHub.svelte";
import GrowthChoice from "./GrowthChoice.svelte";
import Party from "./Party.svelte";
import "../campaign.css";
import "../items.css";
import EquipmentSelect from "./EquipmentSelect.svelte";

let {
  root,
  frame,
  send,
}: { root?: HTMLElement; frame: CampaignFrame | null; send: (event: CampaignEvent) => boolean } = $props();
let internalRoot = $state<HTMLDivElement>();
let scope = $derived(root ?? internalRoot);

let partyRoot = $state<HTMLElement>();
let focus = $derived(frame?.focus);
let waiting = $derived(frame !== null && "waiting" in frame && frame.waiting);
const settings = parseAdventureSettings(savedAdventureSettings);
$effect(() => {
  if (
    !focus ||
    frame?.kind === "town" ||
    frame?.kind === "growth" ||
    frame?.kind === "home" ||
    frame?.kind === "destinations" ||
    (frame?.kind === "confirm" && frame.hub.confirmation !== "new-game")
  )
    return;
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
  const node = selector ? scope?.querySelector<HTMLElement>(selector) : null;
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

{#snippet content()}
  {#if frame && scope && frame.kind !== "disposed" && frame.kind !== "dungeon"}
    {#if frame.kind === "home" ||
  frame.kind === "destinations" ||
  (frame.kind === "town" && frame.hub && frame.town.adventure.mode === "town") ||
  (frame.kind === "confirm" && frame.hub.confirmation !== "new-game")}
      <CampaignHub root={scope} {frame} {send} />
    {:else if frame.kind === "town"}
      <Adventure
        root={scope}
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
        <div class="campaign-art" aria-hidden="true"></div>
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
              {#each frame.copy as text}
                <p>{text}</p>
              {/each}
              {#if frame.kind === "equipment"}
                {#each frame.members as member (member.id)}
                  <p>{member.summary}</p>
                  {#each member.slots as field (field.slot)}
                    <label for={`equipment-${member.id}-${field.slot}`}
                      >{field.label}<EquipmentSelect
                        id={`equipment-${member.id}-${field.slot}`}
                        options={field.options}
                        data-character={member.id}
                        data-slot={field.slot}
                        value={field.selected}
                        onchange={(event) =>
  send({ type: "equip", characterId: member.id, slot: field.slot, instanceId: event.currentTarget.value || null })}
                        onfocus={() => send({ type: "focused", target: { kind: "equipment", characterId: member.id, slot: field.slot } })}
                      /></label
                    >
                  {/each}
                {/each}
              {/if}
            </div>
            <nav class="campaign-commands" aria-label={frame.title}>
              {#each frame.commands as command (command.command)}
                <CampaignCommand
                  primary={command.primary}
                  label={command.label}
                  data-command={command.command}
                  disabled={waiting}
                  onclick={() => send({ type: "command", command: command.command })}
                  onfocus={() => send({ type: "focused", target: { kind: "command", command: command.command } })}
                />
              {/each}
            </nav>
            <p class="campaign-status" role="status">{frame.status}</p>
          {/if}
        </section>
      </main>
    {/if}
  {/if}
{/snippet}

{#if root}
  {@render content()}
{:else}
  <div bind:this={internalRoot}>{@render content()}</div>
{/if}
