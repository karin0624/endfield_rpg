<script lang="ts">
import { onMount } from "svelte";
import { on } from "svelte/events";
import { parseAdventureSettings } from "../../presentation/adventureSettings";
import type { DungeonEvent } from "../../presentation/dungeonModel";
import type { DungeonChromeFrame, DungeonFrame } from "../../presentation/dungeonProjection";
import { projectRouteEdge, type RouteImageMeasure } from "../../presentation/dungeonRoute";
import savedAdventureSettings from "../adventure-settings.json";
import { applyAdventureSettings } from "../adventureSettings";
import BranchRecovery from "./BranchRecovery.svelte";
import Conversation from "./Conversation.svelte";
import GrowthChoice from "./GrowthChoice.svelte";

let {
  root,
  frame,
  battleStatus,
  send,
}: {
  root: HTMLElement;
  frame: DungeonChromeFrame | null;
  battleStatus: NonNullable<DungeonFrame["battle"]>["status"] | null;
  send: (event: DungeonEvent) => boolean;
} = $props();
let viewport: HTMLDivElement, world: HTMLDivElement, conversation: HTMLElement;
let paths = $state.raw<{ from: string; to: string; appearance: string; d: string }[]>([]);
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
let nodes = $derived(frame?.route.nodes),
  edges = $derived(frame?.route.edges),
  kind = $derived(frame?.kind),
  width = $derived(frame?.route.width),
  focus = $derived(frame?.focus);
function imageMeasure(button: HTMLElement): RouteImageMeasure {
  const image = button.querySelector("img");
  if (!image) throw new Error("Route node image is required");
  return {
    centerX: button.offsetLeft,
    centerY: button.offsetTop,
    buttonWidth: button.offsetWidth,
    buttonHeight: button.offsetHeight,
    imageLeft: image.offsetLeft,
    imageTop: image.offsetTop,
    imageWidth: image.offsetWidth,
    imageHeight: image.offsetHeight,
  };
}
function measureRoute() {
  if (kind !== "route" || !nodes || !edges) return;
  const requested = world.style.width;
  world.style.width = "";
  const responsiveWorldWidth = world.clientWidth;
  world.style.width = requested;
  const nodeElements = new Map(
    [...world.querySelectorAll<HTMLElement>("[data-node-id]")].map((node) => [node.dataset.nodeId as string, node]),
  );
  send({
    type: "route",
    event: {
      type: "measured",
      measure: {
        viewportWidth: viewport.clientWidth,
        responsiveWorldWidth,
        nodes: nodes.map((node) => {
          const button = nodeElements.get(node.id);
          if (!button) throw new Error("Route node is required");
          return { id: node.id, fraction: node.position.x / 100, center: button.offsetLeft, width: button.offsetWidth };
        }),
      },
    },
  });
  const bounds = world.getBoundingClientRect();
  if (bounds.width && bounds.height)
    paths = edges.flatMap((edge) => {
      const source = nodeElements.get(edge.from),
        target = nodeElements.get(edge.to);
      return source && target
        ? [{ ...edge, d: projectRouteEdge(imageMeasure(source), imageMeasure(target), bounds) }]
        : [];
    });
}
$effect(() => {
  nodes;
  edges;
  width;
  kind;
  measureRoute();
});
$effect(() => {
  if (!focus || !frame) return;
  const selector =
    focus.kind === "return"
      ? `[data-${frame.kind === "outcome" ? "outcome" : "route"}-screen] [data-return-town]`
      : focus.kind === "route"
        ? "[data-route-viewport]"
        : focus.kind === "node"
          ? `[data-node-id="${CSS.escape(focus.id)}"]`
          : focus.kind === "choice"
            ? `[data-option-id="${CSS.escape(focus.id)}"]`
            : null;
  const node = selector ? root.querySelector<HTMLElement>(selector) : null;
  if (node && node !== document.activeElement) node.focus();
});
function routeKey(event: KeyboardEvent) {
  if (send({ type: "route", event: { type: "pan-key", key: event.key } })) {
    event.preventDefault();
    event.stopPropagation();
  }
}
onMount(() => {
  document.body.classList.add("dungeon-mode");
  applyAdventureSettings(conversation, parseAdventureSettings(savedAdventureSettings));
  const events = new AbortController(),
    signal = events.signal,
    motion = matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", () => send({ type: "motion", reduced: motion.matches }), { signal });
  window.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "key", key: event.key, code: event.code, shift: event.shiftKey })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal },
  );
  const context = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || target.matches("input,select,textarea"))
      ? ("text-entry" as const)
      : target === viewport || (target instanceof HTMLElement && target.matches("button,a[href]"))
        ? ("control" as const)
        : ("screen" as const);
  on(window, "focusin", (event) => send({ type: "input-context", context: context(event.target) }), {
    signal,
  });
  // A focused growth choice can emit a native event during branch teardown.
  on(window, "focusout", (event) => send({ type: "input-context", context: context(event.relatedTarget) }), { signal });
  const observer = new ResizeObserver(measureRoute);
  observer.observe(viewport);
  return () => {
    observer.disconnect();
    events.abort();
    document.body.classList.remove("dungeon-mode");
  };
});
</script>
<main class="dungeon-app" data-dungeon-app>
  <section class="dungeon-route-screen" data-route-screen aria-label="遺跡の進路" hidden={frame?.kind !== "route"}>
    <div
      class="dungeon-route-background"
      data-route-background
      aria-hidden="true"
      style:transform={`translate3d(${(frame?.route.offset ?? 0) * 0.42}px, 0, 0)`}
    >
      <img src={assetUrl("backgrounds/dungeon-route.png")} alt="">
    </div>
    <button
      type="button"
      class="dungeon-town-link"
      data-return-town
      data-single-activation
      onclick={() => send({ type: "return" })}
      onfocus={() => send({ type: "focused", target: { kind: "return" } })}
    >
      {frame?.returnLabel ?? "街へ戻る"}
    </button>
    <p class="dungeon-calendar" data-calendar>{frame?.calendar ?? ""}</p>
    <!-- Keyboard pan is a documented operation in addition to pointer dragging. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <!-- biome-ignore-start lint/a11y/noNoninteractiveTabindex lint/a11y/useSemanticElements: The route is a keyboard pan target. -->
    <div
      role="region"
      class="dungeon-route-viewport"
      data-route-viewport
      tabindex="0"
      aria-label="横へドラッグして移動できる遺跡ルート"
      data-route-offset={Math.round(frame?.route.offset ?? 0)}
      class:is-dragging={frame?.route.dragging ?? false}
      bind:this={viewport}
      onfocus={() => send({ type: "focused", target: { kind: "route" } })}
      onkeydown={routeKey}
      onpointerdown={(event) =>
  send({
    type: "route",
    event: { type: "pointer-down", pointerId: event.pointerId, x: event.clientX, button: event.button },
  })}
      onpointermove={(event) => send({ type: "route", event: { type: "pointer-move", pointerId: event.pointerId, x: event.clientX } })}
      onpointerup={(event) => send({ type: "route", event: { type: "pointer-end", pointerId: event.pointerId } })}
      onpointercancel={(event) => send({ type: "route", event: { type: "pointer-end", pointerId: event.pointerId } })}
    >
      <div
        class="dungeon-route-world"
        data-route-world
        bind:this={world}
        style:width={frame?.route.width === null || frame?.route.width === undefined ? undefined : `${frame.route.width}px`}
        style:transform={`translate3d(${frame?.route.offset ?? 0}px, 0, 0)`}
      >
        <svg
          class="dungeon-route-edges"
          data-route-edges
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {#each paths as path (`${path.from}:${path.to}`)}
            <path
              class="dungeon-route-edge is-{path.appearance}"
              data-edge-from={path.from}
              data-edge-to={path.to}
              d={path.d}
            />
          {/each}
        </svg>
        <div role="group" class="dungeon-route-nodes" data-route-nodes aria-label="ルート上のノード">
          {#each frame?.route.nodes ?? [] as node (node.id)}
            <button
              type="button"
              class="dungeon-route-node type-{node.type}"
              class:is-current={node.current}
              class:is-available={node.enabled}
              class:is-past-unselected={node.past}
              class:is-resolved={node.resolved}
              disabled={!node.enabled}
              style:left={`${node.position.x}%`}
              style:top={`${node.position.y}%`}
              data-node-id={node.id}
              data-node-type={node.type}
              data-node-state={node.status}
              aria-label={node.label}
              aria-current={node.current ? "location" : undefined}
              onclick={() => send({ type: "enter", nodeId: node.id })}
              onfocus={() => send({ type: "focused", target: { kind: "node", id: node.id } })}
            >
              <img
                src={assetUrl(node.icon)}
                alt=""
                draggable="false"
                decoding="sync"
                aria-hidden="true"
                onload={measureRoute}
              >
              {#if node.title !== null}
                <span class="dungeon-route-node-label">{node.title}</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
    <!-- biome-ignore-end lint/a11y/noNoninteractiveTabindex lint/a11y/useSemanticElements: End of keyboard scroll region. -->
    {#if frame}
      <BranchRecovery
        {root}
        frame={frame.branch}
        result={frame.branchResult}
        send={(event) => send({ type: "branch", event })}
      />
    {/if}
  </section>
  <section
    class="adventure-screen dungeon-conversation-screen"
    data-conversation-screen
    aria-label="遺跡の会話"
    hidden={frame?.kind !== "conversation"}
    bind:this={conversation}
  >
    <div
      class="adventure-background"
      data-conversation-background
      data-background-id={frame?.conversation?.backgroundId ?? "roadside"}
      aria-hidden="true"
    >
      <img src={assetUrl("backgrounds/landscape1.png")} alt="">
    </div>
    <Conversation
      scene={frame?.conversation?.scene ?? null}
      advance={() => send({ type: "advance" })}
      choose={(optionId) => send({ type: "choose", optionId })}
      focused={(id) => send({ type: "focused", target: { kind: "choice", id } })}
    />
  </section>
  <section
    class="dungeon-battle-screen"
    data-battle-screen
    aria-label="ダンジョン戦闘"
    hidden={frame?.kind !== "battle"}
  >
    <main class="battle-screen">
      <div class="game-board" data-board>
        <section class="stage" aria-label="ダンジョンの戦闘画面">
          <canvas aria-label="味方と敵の戦闘" data-ready={battleStatus?.ready ? "true" : undefined}></canvas>
          <div
            class="loading"
            class:sr-only={battleStatus?.ready ?? false}
            role="status"
            data-status
            data-error={battleStatus?.error ? "" : undefined}
          >
            {battleStatus?.text ?? "戦闘画面を読み込んでいます…"}
          </div>
        </section>
      </div>
    </main>
  </section>
  <section
    class="dungeon-outcome-screen"
    data-outcome-screen
    aria-labelledby="dungeon-outcome-title"
    hidden={frame?.kind !== "outcome"}
    style:background-image={`linear-gradient(180deg, #171d19d9, #171d19ee), url("${assetUrl("backgrounds/dungeon-route.png")}")`}
  >
    <p class="dungeon-eyebrow">EXPEDITION RESULT</p>
    <h1 id="dungeon-outcome-title" data-outcome-title>{frame?.outcome.title ?? ""}</h1>
    <p data-outcome-detail>{frame?.outcome.detail ?? ""}</p>
    <button
      type="button"
      class="dungeon-outcome-return"
      data-return-town
      data-single-activation
      onclick={() => send({ type: "return" })}
      onfocus={() => send({ type: "focused", target: { kind: "return" } })}
    >
      {frame?.returnLabel ?? "街へ戻る"}
    </button>
  </section>
  <section data-growth-screen hidden={frame?.kind !== "growth"}>
    {#if frame?.growth}
      <GrowthChoice frame={frame.growth} focus={frame.growthFocus} send={(event) => send({ type: "growth", event })} />
    {/if}
  </section>
  <p class="sr-only" data-dungeon-status role="status" aria-live="polite">{frame?.status ?? ""}</p>
</main>
