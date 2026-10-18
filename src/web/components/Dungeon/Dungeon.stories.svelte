<script lang="ts">
import type { ComponentProps } from "svelte";
import { dungeonPicture } from "../../../../tests/dungeonPictures";
import { reduceDungeon } from "../../../presentation/dungeonModel";
import { projectDungeonChrome } from "../../../presentation/dungeonProjection";
import Dungeon from "./Dungeon.svelte";

let { frame, send, ...attributes }: ComponentProps<typeof Dungeon> = $props();
const picture = dungeonPicture();
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
