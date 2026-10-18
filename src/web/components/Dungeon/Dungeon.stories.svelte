<script lang="ts">
import type { ComponentProps } from "svelte";
import { createDungeonRoute, projectRouteLayout, reduceDungeonRoute } from "../../../presentation/dungeonRoute";
import Dungeon from "./Dungeon.svelte";

let { frame, send, ...attributes }: ComponentProps<typeof Dungeon> = $props();
let routeState = $state.raw(createDungeonRoute());
let accessibleIds = $derived(
  frame?.route.nodes.filter((node) => node.current || node.enabled).map((node) => node.id) ?? [],
);
let shown = $derived(
  frame
    ? {
        ...frame,
        route: { ...frame.route, ...(routeState.measure ? projectRouteLayout(routeState, accessibleIds) : {}) },
      }
    : null,
);
const dispatch: ComponentProps<typeof Dungeon>["send"] = (event) => {
  if (event.type !== "route" || event.event.type !== "measured") return send(event);
  const changed = reduceDungeonRoute(routeState, event.event, accessibleIds);
  routeState = changed.state;
  return changed.handled;
};
</script>

<Dungeon {...attributes} frame={shown} send={dispatch} />
