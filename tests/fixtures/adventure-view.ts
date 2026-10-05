import { initialAdventure } from "../../src/content/initialAdventure";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { projectAdventure } from "../../src/presentation/adventureProjection";
import { parseAdventureSettings } from "../../src/presentation/adventureSettings";
import savedAdventureSettings from "../../src/web/adventure-settings.json";
import { createAdventureView } from "../../src/web/adventureView.svelte.ts";
import "../../src/web/style.css";
import "../../src/web/debug.css";

const choice = new URLSearchParams(location.search).has("choice");
const frame = projectAdventure({
  state: {
    ...createInitialGameState(initialGameOptions),
    mode: "conversation",
    currentPlaceId: "guild",
    conversationId: "guild-first",
    conversationPosition: choice ? "ask-about-work" : "greeting",
  },
  definition: initialAdventure,
  calendar: "1日目 · 昼",
  feedback: [],
  prompt: "行き先を選ぶ",
  partyEntry: true,
  debug: true,
  editorEntry: false,
  focus: null,
});
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing picture root");
createAdventureView(root, frame.utilities, () => false, parseAdventureSettings(savedAdventureSettings)).render(frame);
