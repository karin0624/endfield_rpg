<script lang="ts">
import art from "../hub-art.json";

let {
  id,
  label,
  picture,
  round = false,
  movement = false,
  position,
  onclick,
  onfocus,
  accessibleName,
}: {
  id: string;
  label: string;
  picture: keyof typeof art.horizontal | keyof typeof art.marker;
  round?: boolean;
  movement?: boolean;
  position?: [number, number];
  onclick?: () => void;
  onfocus?: () => void;
  accessibleName?: string;
} = $props();
const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
let frame = $derived(round ? art.bubble : art.frames[movement ? "blue" : "yellow"]);
let placement = $derived(
  round ? art.marker[picture as keyof typeof art.marker] : art.horizontal[picture as keyof typeof art.horizontal],
);
let isFace = $derived(picture === "gilberta");
let width = $derived(round ? 128 : art.button.width);
let height = $derived(round ? art.bubble.display[1] : art.button.height);
</script>
<button
  type="button"
  data-command={id}
  data-place-id={round ? id : undefined}
  class="entry"
  class:round
  class:framed={!round}
  class:movement
  style={position ? `--anchor-x:${position[0]}px;--anchor-y:${position[1]}px` : undefined}
  aria-label={accessibleName}
  {onclick}
  {onfocus}
>
  <span class={round ? "disc" : "button-picture"}>
    <svg
      class="frame-art"
      viewBox={frame.crop.join(" ")}
      preserveAspectRatio={round ? "xMidYMid meet" : "none"}
      aria-hidden="true"
    >
      <image href={asset(frame.path)} width={frame.natural[0]} height={frame.natural[1]} />
    </svg>
    <svg class="glyph" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {#if isFace}
        <defs>
          <clipPath id="hub-face">
            <ellipse
              cx={art.marker.gilberta.faceViewportEllipse[0]}
              cy={art.marker.gilberta.faceViewportEllipse[1]}
              rx={art.marker.gilberta.faceViewportEllipse[2]}
              ry={art.marker.gilberta.faceViewportEllipse[3]}
            />
          </clipPath>
        </defs>
      {/if}
      <image
        href={asset(isFace ? "characters/gilberta/expressions/neutral.png" : `ui/hubs/${picture}.png`)}
        x={placement.imagePositionCss[0]}
        y={placement.imagePositionCss[1]}
        width={(isFace ? 1024 : 1254) * placement.scaleCssPerSourcePixel}
        height={(isFace ? 1536 : 1254) * placement.scaleCssPerSourcePixel}
        clip-path={isFace ? "url(#hub-face)" : undefined}
      />
    </svg>
  </span>
  <span class="label">{label}</span>
</button>
