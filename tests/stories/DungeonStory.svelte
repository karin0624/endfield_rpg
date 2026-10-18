<script lang="ts">
import type { ComponentProps } from "svelte";
import { reduceDungeon } from "../../src/presentation/dungeonModel";
import { projectDungeonChrome } from "../../src/presentation/dungeonProjection";
import Dungeon from "../../src/web/components/Dungeon.svelte";
import { dungeonPicture } from "../dungeonPictures";

let { frame, send, ...attributes }: ComponentProps<typeof Dungeon> = $props();
const picture = dungeonPicture("items");
let dungeonState = $state.raw(picture.state);
let route = $derived(projectDungeonChrome(dungeonState, picture.input, frame?.returnLabel).route);
let shown = $derived(frame ? { ...frame, route } : null);
const dispatch: ComponentProps<typeof Dungeon>["send"] = (event) => {
  if (event.type !== "route" || event.event.type !== "measured") return send(event);
  const changed = reduceDungeon(dungeonState, picture.input, event);
  dungeonState = changed.state;
  return changed.handled;
};
</script>

<Dungeon {...attributes} frame={shown} send={dispatch} />
