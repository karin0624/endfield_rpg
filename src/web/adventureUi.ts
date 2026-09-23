import { initialAdventure } from "../content/initialAdventure";
import { initialGameOptions } from "../content/initialGameOptions";
import {
  advanceConversation,
  type ConversationPresentation,
  chooseConversationOption,
  getAvailableTownPlaces,
  getCurrentConversationScene,
  selectTownPlace,
} from "../game/adventure";
import { createInitialGameState } from "../game/createInitialGameState";
import savedAdventureSettings from "./adventure-settings.json";
import { type AdventureSettings, applyAdventureSettings, parseAdventureSettings } from "./adventureSettings";
import { requiredElement } from "./requiredElement";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;

const portraitAssets: Readonly<Record<string, string>> = {
  rossi: "characters/rossi/expressions/neutral.png",
  gilberta: "characters/gilberta/expressions/neutral.png",
};

function portraitAssetPath(portraitId: string, expressionId: string | undefined): string | undefined {
  if (portraitAssets[portraitId] === undefined) return undefined;
  if (expressionId === "smile") return `characters/${portraitId}/expressions/smile.png`;
  return portraitAssets[portraitId] ?? undefined;
}

function getPortraitCast(conversationId: string): Map<string, ConversationPresentation> {
  const conversation = initialAdventure.conversations.find((candidate) => candidate.id === conversationId);
  const cast = new Map<string, ConversationPresentation>();
  if (conversation === undefined) return cast;

  for (const node of Object.values(conversation.nodes)) {
    if (node.type !== "line" && node.type !== "choice") continue;
    const { portraitId } = node;
    if (portraitId !== undefined && portraitId in portraitAssets && !cast.has(portraitId)) {
      cast.set(portraitId, {
        portraitId,
        speakerName: node.speakerName,
        expressionId: node.expressionId,
        position: node.position,
      });
    }
  }
  return cast;
}

function createTetrahedron(): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("choice-tetrahedron");
  icon.setAttribute("viewBox", "0 0 32 32");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = `
    <polygon points="30,16 4,3 4,29" fill="#394438" stroke="#f0b84a" stroke-width="1.5" />
    <path d="M30 16H4M4 3l12 13L4 29" fill="none" stroke="#f0b84a" stroke-width="1.2" />
  `;
  return icon;
}

export function mountAdventureUi(
  root: HTMLDivElement,
  initialSettings = parseAdventureSettings(savedAdventureSettings),
) {
  root.innerHTML = `
    <main class="adventure-shell">
      <div class="adventure-screen" data-adventure-screen data-mode="town">
        <div class="adventure-background" data-background-id="town-square" aria-hidden="true">
          <img src="${assetUrl("backgrounds/landscape1.png")}" alt="" />
        </div>
        <section class="town-view" data-town-view aria-labelledby="town-title">
          <header class="town-heading">
            <p class="adventure-eyebrow">OUTPOST / TOWN</p>
            <h1 id="town-title">街の広場</h1>
            <p>行き先を選ぶ</p>
          </header>
          <nav class="town-places" data-town-places aria-label="街の場所"></nav>
          <div class="town-utility-controls">
            <a class="battle-entry" href="?battle=1">戦闘デモを見る</a>
            ${import.meta.env.DEV ? '<a class="adventure-editor-entry" href="?adventureEdit=1">会話画面の配置設定</a>' : ""}
          </div>
        </section>
        <section class="conversation-view" data-conversation-view aria-label="会話" hidden>
          <div class="conversation-stage" data-conversation-stage>
            <div class="conversation-portraits" data-conversation-portraits aria-hidden="true"></div>
            <div class="conversation-choices" data-conversation-choices aria-label="選択肢"></div>
            <div class="dialogue-panel" data-dialogue-panel aria-live="polite">
              <div class="dialogue-speaker" data-speaker></div>
              <div class="dialogue-divider"></div>
              <p class="dialogue-text" data-dialogue-text></p>
              <span class="dialogue-next" data-dialogue-next aria-hidden="true"></span>
            </div>
          </div>
        </section>
        <p class="sr-only" data-adventure-status role="status" aria-live="polite"></p>
      </div>
    </main>
  `;

  const screen = requiredElement<HTMLDivElement>(root, "[data-adventure-screen]");
  const townView = requiredElement<HTMLElement>(root, "[data-town-view]");
  const townPlaces = requiredElement<HTMLElement>(root, "[data-town-places]");
  const conversationView = requiredElement<HTMLElement>(root, "[data-conversation-view]");
  const conversationStage = requiredElement<HTMLElement>(root, "[data-conversation-stage]");
  const portraits = requiredElement<HTMLElement>(root, "[data-conversation-portraits]");
  const choices = requiredElement<HTMLElement>(root, "[data-conversation-choices]");
  const speaker = requiredElement<HTMLElement>(root, "[data-speaker]");
  const dialogueText = requiredElement<HTMLParagraphElement>(root, "[data-dialogue-text]");
  const nextIndicator = requiredElement<HTMLSpanElement>(root, "[data-dialogue-next]");
  const status = requiredElement<HTMLParagraphElement>(root, "[data-adventure-status]");
  const events = new AbortController();
  let state = createInitialGameState(initialGameOptions);
  let disposed = false;
  applyAdventureSettings(screen, initialSettings);

  function applyAcceptedState(
    result:
      | ReturnType<typeof selectTownPlace>
      | ReturnType<typeof advanceConversation>
      | ReturnType<typeof chooseConversationOption>,
  ): void {
    if (result.accepted) {
      state = result.state;
      render();
    }
  }

  function renderTown(): void {
    const fragment = document.createDocumentFragment();
    for (const [index, place] of getAvailableTownPlaces(state, initialAdventure).entries()) {
      const button = document.createElement("button");
      button.className = "town-place";
      button.type = "button";
      button.dataset.placeId = place.id;
      button.setAttribute("aria-label", place.label);

      const number = document.createElement("span");
      number.className = "town-place-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const label = document.createElement("span");
      label.className = "town-place-label";
      label.textContent = place.label;
      const arrow = document.createElement("span");
      arrow.className = "town-place-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "›";
      button.append(number, label, arrow);
      button.addEventListener("click", () => applyAcceptedState(selectTownPlace(state, place.id, initialAdventure)), {
        signal: events.signal,
      });
      fragment.append(button);
    }
    townPlaces.replaceChildren(fragment);
  }

  function renderPortraits(conversationId: string, presentation: ConversationPresentation): void {
    const cast = getPortraitCast(conversationId);
    const fragment = document.createDocumentFragment();
    for (const [portraitId, initialPresentation] of cast) {
      const currentSpeaker = presentation.portraitId === portraitId;
      const portrait = document.createElement("figure");
      portrait.className = `conversation-portrait${currentSpeaker ? " is-speaking" : " is-muted"}`;
      portrait.dataset.portraitId = portraitId;
      const position = currentSpeaker ? presentation.position : initialPresentation.position;
      portrait.dataset.position = position ?? "center";
      const imagePath = portraitAssetPath(
        portraitId,
        currentSpeaker ? presentation.expressionId : initialPresentation.expressionId,
      );
      if (imagePath !== undefined) {
        const image = document.createElement("img");
        image.src = assetUrl(imagePath);
        image.alt = "";
        image.decoding = "async";
        portrait.append(image);
      }
      fragment.append(portrait);
    }
    if (document.body.classList.contains("adventure-editing")) {
      const rightPreview = document.createElement("figure");
      rightPreview.className = "conversation-portrait is-muted";
      rightPreview.dataset.portraitId = "rossi-preview";
      rightPreview.dataset.position = "right";
      const image = document.createElement("img");
      image.src = assetUrl(portraitAssets.rossi);
      image.alt = "";
      rightPreview.append(image);
      fragment.append(rightPreview);
    }
    portraits.replaceChildren(fragment);
  }

  function renderChoices(
    scene: Extract<NonNullable<ReturnType<typeof getCurrentConversationScene>>, { type: "choice" }>,
  ): void {
    const fragment = document.createDocumentFragment();
    scene.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "conversation-choice";
      button.type = "button";
      button.dataset.optionId = option.id;
      const marker = createTetrahedron();
      const number = document.createElement("span");
      number.className = "choice-number";
      number.textContent = String(index + 1);
      const label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = option.label;
      button.append(marker, number, label);
      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();
          applyAcceptedState(chooseConversationOption(state, option.id, initialAdventure));
        },
        { signal: events.signal },
      );
      fragment.append(button);
    });
    choices.replaceChildren(fragment);
    choices.hidden = scene.options.length === 0;
  }

  function renderConversation(): void {
    const scene = getCurrentConversationScene(state, initialAdventure);
    if (scene === null) {
      conversationView.hidden = true;
      townView.hidden = false;
      screen.dataset.mode = "town";
      return;
    }

    conversationView.hidden = false;
    townView.hidden = true;
    screen.dataset.mode = "conversation";
    screen.dataset.backgroundId = scene.presentation.backgroundId ?? state.currentPlaceId;
    renderPortraits(scene.conversationId, scene.presentation);
    speaker.textContent = scene.presentation.speakerName ?? "";
    dialogueText.textContent = scene.type === "line" ? scene.text : (scene.prompt ?? "");
    nextIndicator.hidden = scene.type !== "line";
    if (scene.type === "choice") {
      renderChoices(scene);
      conversationStage.dataset.sceneType = "choice";
      return;
    }
    choices.replaceChildren();
    choices.hidden = true;
    conversationStage.dataset.sceneType = "line";
  }

  function render(): void {
    if (disposed) return;
    if (state.mode === "town") {
      screen.dataset.mode = "town";
      screen.dataset.backgroundId = state.currentPlaceId;
      conversationView.hidden = true;
      townView.hidden = false;
      renderTown();
      status.textContent = "街の場所を選べます";
      return;
    }
    renderConversation();
    status.textContent = "会話中";
  }

  conversationStage.addEventListener(
    "click",
    (event) => {
      if ((event.target as Element).closest("button") !== null) return;
      const scene = getCurrentConversationScene(state, initialAdventure);
      if (scene?.type === "line") applyAcceptedState(advanceConversation(state, initialAdventure));
    },
    { signal: events.signal },
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, select, textarea, [contenteditable='true']")
      )
        return;
      const scene = getCurrentConversationScene(state, initialAdventure);
      if (event.repeat || scene === null) return;
      if (scene.type === "choice" && /^(Digit|Numpad)[1-9]$/.test(event.code)) {
        const option = scene.options[Number(event.code.at(-1)) - 1];
        if (option === undefined) return;
        event.preventDefault();
        applyAcceptedState(chooseConversationOption(state, option.id, initialAdventure));
      } else if (event.code === "Space" && scene.type === "line") {
        event.preventDefault();
        applyAcceptedState(advanceConversation(state, initialAdventure));
      }
    },
    { signal: events.signal },
  );

  render();
  return {
    applySettings(settings: AdventureSettings) {
      applyAdventureSettings(screen, settings);
    },
    dispose() {
      disposed = true;
      events.abort();
    },
  };
}
