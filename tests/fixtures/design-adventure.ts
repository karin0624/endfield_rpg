import { tick } from "svelte";
import { initialAdventure } from "../../src/content/initialAdventure";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { type AdventureFrame, projectAdventure } from "../../src/presentation/adventureProjection";
import { parseAdventureSettings } from "../../src/presentation/adventureSettings";
import savedSettings from "../../src/web/adventure-settings.json";
import { createAdventureView } from "../../src/web/adventureView.svelte.ts";
import { isolateDesignComponent } from "./design-isolation";
import type { DesignCase } from "./design-view";

const text = (props: Record<string, unknown>, key: string, fallback: string) => String(props[key] ?? fallback);

function frameFor(props: Record<string, unknown>): AdventureFrame {
  const type = text(props, "type", "line");
  const frame = projectAdventure({
    state: {
      ...createInitialGameState(initialGameOptions),
      mode: "conversation",
      currentPlaceId: "guild",
      conversationId: text(props, "conversationId", "guild-first"),
      conversationPosition: text(props, "nodeId", type === "choice" ? "ask-about-work" : "approach-guild"),
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
  if (!frame.scene) throw new Error("A conversation scene is required");
  return {
    ...frame,
    scene: {
      ...frame.scene,
      speaker: text(props, "speaker", frame.scene.speaker),
      text: text(props, "text", frame.scene.text),
      ...(Array.isArray(props.portraits)
        ? { portraits: props.portraits as NonNullable<AdventureFrame["scene"]>["portraits"] }
        : {}),
      ...(Array.isArray(props.choices)
        ? { choices: props.choices as NonNullable<AdventureFrame["scene"]>["choices"] }
        : {}),
    },
  };
}

async function render(root: HTMLElement, props: Record<string, unknown>, selector?: string) {
  if (!(root instanceof HTMLDivElement)) throw new Error("Adventure design root must be a div");
  const frame = frameFor(props);
  createAdventureView(root, frame.utilities, () => false, parseAdventureSettings(savedSettings)).render(frame);
  await tick();
  if (selector) {
    // Keep the actual source host inside the component capture viewport.
    const screen = root.querySelector<HTMLElement>(".adventure-screen");
    if (!screen) throw new Error("The conversation source host is required");
    Object.assign(screen.style, { width: "1920px", height: "1080px", maxWidth: "none", overflow: "visible" });
    const stage = root.querySelector<HTMLElement>(".conversation-stage");
    if (stage) stage.style.overflow = "visible";
    if (selector === ".conversation-choice") {
      const choices = root.querySelector<HTMLElement>(".conversation-choices");
      if (choices) choices.style.overflow = "visible";
    }
    isolateDesignComponent(root, selector);
  }
}

export const cases: Record<string, DesignCase> = {
  screen(root, props) {
    return render(root, props);
  },
  choice(root, props) {
    return render(
      root,
      {
        ...props,
        type: "choice",
        choices: [
          {
            id: "design-choice",
            number: Number(props.number ?? 1),
            label: text(props, "label", "掲示板の依頼について聞く"),
          },
        ],
      },
      ".conversation-choice",
    );
  },
  dialogue(root, props) {
    return render(root, props, ".dialogue-panel");
  },
  portrait(root, props) {
    const id = text(props, "id", "rossi");
    const position = text(props, "position", "center");
    if (!["left", "center", "right"].includes(position)) throw new Error(`Unknown portrait position: ${position}`);
    return render(
      root,
      {
        ...props,
        portraits: [
          {
            id,
            position,
            speaking: props.speaking !== false,
            path: text(props, "path", `characters/${id}/expressions/${text(props, "expression", "neutral")}.png`),
          },
        ],
      },
      ".conversation-portrait",
    );
  },
};
