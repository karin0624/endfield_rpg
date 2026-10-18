import { initialAdventure } from "../../src/content/initialAdventure";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { type AdventureFrame, projectAdventure } from "../../src/presentation/adventureProjection";
import { parseAdventureSettings } from "../../src/presentation/adventureSettings";
import savedSettings from "../../src/web/adventure-settings.json";

export const adventureSettings = parseAdventureSettings(savedSettings);

export function conversationFrame(type: "line" | "choice" = "line"): AdventureFrame {
  return projectAdventure({
    state: {
      ...createInitialGameState(initialGameOptions),
      mode: "conversation",
      currentPlaceId: "guild",
      conversationId: "guild-first",
      conversationPosition: type === "choice" ? "ask-about-work" : "approach-guild",
    },
    definition: initialAdventure,
    calendar: "1日目 · 昼",
    feedback: [],
    prompt: "",
    focus: null,
    home: false,
    debug: false,
    partyEntry: false,
    editorEntry: false,
  });
}
