<script module lang="ts">
export interface StoryHostOptions {
  /** Available content width, excluding the host padding. */
  width?: number | string;
  height?: number | string;
  padding?: number | string;
  className?: string;
}
</script>

<script lang="ts">
import type { Snippet } from "svelte";

let { width, height, padding = 32, className, children }: StoryHostOptions & { children: Snippet } = $props();
const dimension = (value: number | string | undefined) => (typeof value === "number" ? `${value}px` : value);
</script>

<div
  id="app"
  class={className}
  data-design-host
  style:position="relative"
  style:box-sizing="content-box"
  style:width={dimension(width)}
  style:height={dimension(height)}
  style:padding={dimension(padding)}
>
  {@render children()}
</div>
