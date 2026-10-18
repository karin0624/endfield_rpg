<script lang="ts">
import type { Snippet } from "svelte";
import { onMount, tick } from "svelte";
import art from "../hub-art.json";
import HubAction from "./HubAction.svelte";
import HubCalendar from "./HubCalendar.svelte";
import HubFeedback from "./HubFeedback.svelte";
import IllustratedAction from "./IllustratedAction.svelte";
import "../hub.css";

let {
  scene,
  calendar,
  feedback = [],
  places = [],
  command,
  select,
  focused,
  children,
  modal = false,
  hideControls = false,
}: {
  scene: "home" | "town" | "destinations";
  calendar: string;
  feedback?: readonly string[];
  places?: readonly { id: string; label: string }[];
  command: (id: string) => void;
  select?: (id: string) => void;
  focused?: (id: string) => void;
  children?: Snippet;
  modal?: boolean;
  hideControls?: boolean;
} = $props();
let element = $state<HTMLElement>();
let wide = $state(true);
let geometry = $state({ width: 1920, height: 1080, unit: 16 });
let calendarWidth = $derived(art.dates[calendar.endsWith("昼") ? "day" : "night"].displayWidth);
function anchor(point: readonly number[]): [number, number] {
  const { width, height, unit } = geometry,
    base = 1920 / 1672,
    baseY = (1080 - 941 * base) / 2;
  const scale = Math.max(width / 1672, height / 941);
  return [
    Math.round((width - 1672 * scale) / 2 + (scale * point[0]) / base - 5 * unit),
    Math.round((height - 941 * scale) / 2 + (scale * (point[1] - baseY)) / base - 4 * unit),
  ];
}
const locationArt = {
  guild: { label: "酒場", picture: "tavern", position: [270, 325] },
  "town-square": { label: "広場", picture: "fountain", position: [995, 440] },
  market: { label: "市場", picture: "market", position: [1605, 390] },
  "find-companion": { label: "ギルベルタ", picture: "gilberta", position: [1175, 798] },
} as const;
let available = $derived(
  Object.entries(locationArt)
    .filter(([id]) => places.some((place) => place.id === id))
    .map(([id, art]) => ({ id, ...art })),
);
let feedbackText = $derived(feedback.join("\n"));
let layoutGeneration = 0;
async function layout() {
  if (!element?.isConnected) return;
  const owner = element;
  const generation = ++layoutGeneration;
  const activeMenu = element.querySelector<HTMLElement>(".system-entry:focus,.map-close:focus");
  const unit = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const width = innerWidth,
    height = innerHeight,
    scale = Math.max(width / 1672, height / 941);
  if (geometry.width !== width || geometry.height !== height || geometry.unit !== unit)
    geometry = { width, height, unit };
  element.style.setProperty("--cover-scale", String(scale));
  element.style.setProperty("--cover-x", `${(width - 1672 * scale) / 2}px`);
  element.style.setProperty("--cover-y", `${(height - 941 * scale) / 2}px`);
  // Cover geometry and the reviewed anchors share the original 1672x941 image space.
  wide = width > 900 && height > 650 && width > height;
  // Measure the candidate layout after its anchors and mode have reached the DOM.
  // A compact layout's rectangles cannot determine whether the wide layout fits.
  await tick();
  if (generation !== layoutGeneration || !owner.isConnected) return;
  if (wide) {
    const rects = [
      ...element.querySelectorAll<HTMLElement>(
        ".home-tools,.locations>.entry,.travel,.progress-clock,.system-entry,.map-close,.result",
      ),
    ].map((node) => node.getBoundingClientRect());
    wide =
      rects.every((r) => r.left >= 6 && r.top >= 6 && r.right <= width - 6 && r.bottom <= height - 6) &&
      rects.every((r, i) =>
        rects
          .slice(i + 1)
          .every(
            (s) =>
              !(
                r.left < s.right + unit &&
                r.right + unit > s.left &&
                r.top < s.bottom + unit &&
                r.bottom + unit > s.top
              ),
          ),
      );
  }
  if (activeMenu) {
    void tick().then(() => {
      if (!activeMenu.isConnected && document.activeElement === document.body)
        element?.querySelector<HTMLElement>(".system-entry,.map-close")?.focus({ preventScroll: true });
    });
  }
}
onMount(() => {
  let active = true;
  void layout();
  // Layout is derived from the viewport, not from the main element's resulting size.
  // Observing that result would feed a mode change back into the measurement.
  window.addEventListener("resize", layout);
  void document.fonts.ready.then(() => {
    if (active) void layout();
  });
  return () => {
    active = false;
    layoutGeneration += 1;
    window.removeEventListener("resize", layout);
  };
});
const focus = (id: string) => focused?.(id);
$effect(() => {
  feedbackText;
  scene;
  hideControls;
  void tick().then(layout);
});
</script>
<main
  class="hub-scene"
  aria-label={scene === "home" ? "ホーム" : scene === "town" ? "街" : "探索先"}
  data-scene={scene}
  data-mode={wide ? "wide" : "compact"}
  data-campaign-screen={scene}
  style:--hub-date-width={`${calendarWidth}px`}
  bind:this={element}
>
  <img
    class="bg"
    src={`${import.meta.env.BASE_URL}assets/ui/hubs/${scene === "destinations" ? "map" : scene}.png`}
    alt=""
    aria-hidden="true"
  >
  {#if !hideControls}
    <div class="hub-controls" inert={modal}>
      {#if feedback.length}
        <HubFeedback messages={feedback} scene={scene === "town" ? "town" : "home"} />
      {/if}
      {#snippet menu()}
        {#if scene === "destinations"}
          <HubAction
            icon="close"
            class="map-close"
            aria-label="地図を閉じる"
            data-command="home"
            onclick={() => command("home")}
            onfocus={() => focus("home")}
          />
        {:else}
          <HubAction icon="menu" data-command="menu" onclick={() => command("menu")} onfocus={() => focus("menu")} />
        {/if}
      {/snippet}
      {#if !wide}
        {@render menu()}
      {/if}
      {#if scene === "home"}
        <div class="home-tools">
          <IllustratedAction
            id="equipment"
            label="仲間"
            picture="companions"
            onclick={() => command("equipment")}
            onfocus={() => focus("equipment")}
          />
          <IllustratedAction id="items" label="アイテム" picture="items" onfocus={() => focus("items")} />
        </div>
      {:else}
        <nav class="locations" aria-label={scene === "town" ? "街の場所と人物" : "探索先"}>
          {#if scene === "destinations"}
            <IllustratedAction
              id="town"
              label="街"
              picture="town-icon"
              round
              position={anchor([480, 670])}
              onclick={() => command("town")}
              onfocus={() => focus("town")}
            />
            <IllustratedAction
              id="prepare-departure"
              label="ダンジョン"
              picture="dungeon"
              round
              position={anchor([1365, 260])}
              onclick={() => command("prepare-departure")}
              onfocus={() => focus("prepare-departure")}
            />
          {:else}
            {#each available as place (place.id)}
              <IllustratedAction
                id={place.id}
                label={place.label}
                picture={place.picture}
                round
                position={anchor(place.position)}
                onclick={() => select?.(place.id)}
                onfocus={() => focus(place.id)}
              />
            {/each}
          {/if}
        </nav>
      {/if}
      {#if scene !== "destinations"}
        <div class="travel-date">
          <div class="travel">
            <IllustratedAction
              id={scene === "home" ? "prepare" : "home"}
              label={scene === "home" ? "出かける" : "ホーム"}
              accessibleName={scene === "town" ? "ホームへ戻る" : undefined}
              picture={scene === "home" ? "map-icon" : "house"}
              movement
              onclick={() => command(scene === "home" ? "prepare" : "home")}
              onfocus={() => focus(scene === "home" ? "prepare" : "home")}
            />
          </div>
          <HubCalendar {calendar} />
        </div>
      {/if}
      {#if wide}
        {@render menu()}
      {/if}
    </div>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</main>
