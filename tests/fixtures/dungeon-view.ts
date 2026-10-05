import { reduceDungeon } from "../../src/presentation/dungeonModel";
import { projectDungeon } from "../../src/presentation/dungeonProjection";
import { createDungeonView } from "../../src/web/dungeonView.svelte.ts";
import { dungeonPicture } from "../dungeonPictures";
import "../../src/web/style.css";
import "../../src/web/debug.css";

const query = new URLSearchParams(location.search);
const picture = dungeonPicture(query.has("items") ? "items" : query.has("progressed") ? "progressed" : "initial");
let state = picture.state;
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing dungeon picture root");
// Only raw layout enters this render-only picture. No game command or journey runs in the browser.
const view = createDungeonView(
  root,
  (event) => {
    if (event.type !== "route" || event.event.type !== "measured") return false;
    const changed = reduceDungeon(state, picture.input, event);
    if (changed.state !== state) {
      state = changed.state;
      view.render(projectDungeon(state, picture.input));
    }
    return changed.handled;
  },
  "街へ戻る",
);
view.render(projectDungeon(state, picture.input));
window.addEventListener(
  "pagehide",
  (event) => {
    if (!event.persisted) view.dispose();
  },
  { once: true },
);
