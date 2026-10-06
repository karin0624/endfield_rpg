<script lang="ts">
import { onMount } from "svelte";
import { on } from "svelte/events";
import type { AdventureEvent } from "../../presentation/adventureModel";
import type { AdventureFrame } from "../../presentation/adventureProjection";
import type { AdventureSettings } from "../../presentation/adventureSettings";
import type { projectTownShop, TownEvent } from "../../presentation/townModel";
import { adventureSettingsStyle } from "../adventureSettings";
import Conversation from "./Conversation.svelte";
import ItemShop from "./ItemShop.svelte";
import Party from "./Party.svelte";

let {
  root,
  frame,
  utilities,
  settings,
  send,
  shop,
  shopSend,
}: {
  root: HTMLElement;
  frame: AdventureFrame | null;
  utilities: AdventureFrame["utilities"];
  settings: AdventureSettings;
  send: (event: AdventureEvent) => boolean;
  shop?: ReturnType<typeof projectTownShop>;
  shopSend?: (event: TownEvent) => boolean;
} = $props();
let partyRoot = $state<HTMLElement>();
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
let style = $derived(adventureSettingsStyle(settings));
let focus = $derived(frame?.focus);
$effect(() => {
  if (!focus) return;
  const selector =
    focus.kind === "place"
      ? `[data-place-id="${CSS.escape(focus.placeId)}"]`
      : focus.kind === "choice"
        ? `[data-option-id="${CSS.escape(focus.optionId)}"]`
        : ".dungeon-entry";
  const node = root.querySelector<HTMLElement>(selector);
  if (node && node !== document.activeElement) node.focus();
});
onMount(() => {
  const events = new AbortController(),
    signal = events.signal;
  window.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "key", code: event.code })) event.preventDefault();
    },
    { signal },
  );
  const context = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || target.matches("input,select,textarea"))
      ? ("text-entry" as const)
      : target instanceof HTMLElement && target.matches("button,a[href]")
        ? ("control" as const)
        : ("screen" as const);
  // Removing a focused node can fire a native event while Svelte is patching a block.
  on(window, "focusin", (event) => send({ type: "input-context", context: context(event.target) }), {
    signal,
  });
  on(window, "focusout", (event) => send({ type: "input-context", context: context(event.relatedTarget) }), { signal });
  return () => events.abort();
});
</script>
<main class="adventure-shell">
  <div
    class="adventure-screen"
    data-adventure-screen
    data-mode={frame?.mode ?? "town"}
    data-background-id={frame?.backgroundId}
    class:party-editing={frame?.party !== undefined}
    {style}
  >
    <div class="adventure-background" aria-hidden="true">
      <img src={frame ? assetUrl(frame.backgroundPath) : undefined} alt="">
    </div>
    <section
      class="town-view"
      data-town-view
      aria-labelledby={frame?.party ? undefined : "town-title"}
      hidden={frame?.mode === "conversation"}
    >
      <header class="town-heading">
        <p class="adventure-eyebrow" data-calendar>{frame?.calendar ?? "OUTPOST / TOWN"}</p>
        <h1 id="town-title">街の広場</h1>
        <p data-town-prompt>{frame?.prompt ?? "行き先を選ぶ"}</p>
        <div class="town-recovery" data-town-recovery role="status" hidden={!frame?.feedback.length}>
          {#each frame?.feedback ?? [] as text}
            <p>{text}</p>
          {/each}
        </div>
        <p data-save-status role="status" hidden={!frame?.saveStatus}>{frame?.saveStatus ?? ""}</p>
      </header>
      <nav class="town-places" data-town-places aria-label="街の場所">
        {#each frame?.places ?? [] as place (place.id)}
          <button
            type="button"
            class="town-place"
            data-place-id={place.id}
            aria-label={place.label}
            onclick={() => send({ type: "select", placeId: place.id })}
            onfocus={() => send({ type: "focused", target: { kind: "place", placeId: place.id } })}
          >
            <span class="town-place-label">{place.label}</span
            ><span class="town-place-arrow" aria-hidden="true">›</span>
          </button>
        {/each}
      </nav>
      <div class="town-utility-controls">
        {#if utilities.party}
          <a
            class="dungeon-entry"
            href="#party-editor"
            onclick={(event) => {
  event.preventDefault();
  send({ type: "open-party" });
}}
            onfocus={() => send({ type: "focused", target: { kind: "party-entry" } })}
            >出撃編成を見る</a
          >
        {/if}
        {#if utilities.debug}
          <button type="button" class="battle-entry" data-save onclick={() => send({ type: "save" })}>保存</button
          ><button type="button" class="battle-entry" data-load onclick={() => send({ type: "load" })}>読込</button>
        {/if}
        {#if utilities.home}
          <button type="button" class="battle-entry" data-home onclick={() => send({ type: "home" })}>
            ホームへ戻る
          </button>
        {/if}
        {#if utilities.debug}
          <a class="battle-entry" href="?debug=1&battle=1">戦闘デモを見る</a>
        {/if}
        {#if utilities.editor}
          <a class="adventure-editor-entry" href="?debug=1&adventureEdit=1">会話画面の配置設定</a>
        {/if}
      </div>
      <section
        id="party-editor"
        class="party-editor"
        aria-label="出撃編成"
        data-party-editor
        bind:this={partyRoot}
        hidden={!frame?.party}
      >
        {#if partyRoot && frame?.party}
          <Party root={partyRoot} frame={frame.party} send={(event) => send({ type: "party", event })} />
        {/if}
      </section>
    </section>
    <section class="conversation-view" data-conversation-view aria-label="会話" hidden={frame?.mode !== "conversation"}>
      <Conversation
        scene={frame?.scene ?? null}
        advance={() => send({ type: "advance" })}
        choose={(optionId) => send({ type: "choose", optionId })}
        focused={(optionId) => send({ type: "focused", target: { kind: "choice", optionId } })}
      />
      {#if shop && shopSend}
        <ItemShop frame={shop} send={shopSend} />
      {/if}
    </section>
    <p class="sr-only" data-adventure-status role="status" aria-live="polite">{frame?.status ?? ""}</p>
  </div>
</main>
