<script lang="ts">
import art from "../hub-art.json";

let { calendar }: { calendar: string } = $props();
let day = $derived(calendar.split(" · ")[0].replace("日目", ""));
let period = $derived(calendar.endsWith("昼") ? ("day" as const) : ("night" as const));
let date = $derived(art.dates[period]);
let region = $derived(date.numericRegion);
let crop = $derived(date.crop);
let scale = $derived(date.displayWidth / crop[2]);
let raise = $derived(art.button.height - (date.displayHeight - date.textFrameDisplayTop) + 6);
</script>
<div
  class="progress-clock"
  role="img"
  aria-label={calendar}
  style={`width:${date.displayWidth}px;height:${date.displayHeight}px;--date-bottom-offset:${raise}px`}
>
  <svg class="date-frame" viewBox={crop.join(" ")} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <clipPath id={`hub-date-${period}`}><path d={date.maskPath} /></clipPath>
    </defs>
    <image
      href={`${import.meta.env.BASE_URL}assets/${date.path}`}
      width={date.natural[0]}
      height={date.natural[1]}
      clip-path={`url(#hub-date-${period})`}
    />
  </svg>
  <span
    class="number-zone"
    style={`color:${period === "night" ? "#fff0c0" : "#3e2b12"};left:${(region[0] - crop[0]) * scale}px;top:${(region[1] - crop[1]) * scale}px;width:${region[2] * scale}px;height:${region[3] * scale}px`}
  >
    <span class="day">{day}</span>
  </span>
</div>
