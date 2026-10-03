import { initialAdventure } from "../content/initialAdventure";
import { initialGameOptions } from "../content/initialGameOptions";
import {
  type AdventureActionResult,
  advanceConversation,
  type ConversationPresentation,
  chooseConversationOption,
  getAvailableTownPlaces,
  getCurrentConversationScene,
  selectTownPlace,
} from "../game/adventure";
import { createInitialGameState, type GameState } from "../game/createInitialGameState";
import savedAdventureSettings from "./adventure-settings.json";
import { type AdventureSettings, applyAdventureSettings, parseAdventureSettings } from "./adventureSettings";
import { type ItemShopOptions, mountItemShop } from "./itemShopUi";
import { mountPartyUi, type PartyUiOptions } from "./partyUi";
import { requiredElement } from "./requiredElement";

export type TownUiCommand =
  | { readonly type: "select"; readonly placeId: string }
  | { readonly type: "advance" }
  | { readonly type: "choose"; readonly optionId: string };

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
  options?: {
    initialState: GameState;
    getCalendarLabel: () => string;
    getFeedback: () => readonly string[];
    saveMessage?: string;
    save?: () => string;
    load?: () => string;
    dispatch: (
      command: TownUiCommand,
      actionId: number | null,
    ) => AdventureActionResult & { readonly recruitedNames?: readonly string[]; readonly actionId?: number };
    party?: PartyUiOptions;
    onHome?: () => void;
    debug?: boolean;
    shop?: ItemShopOptions;
  },
) {
  root.innerHTML = `
    <main class="adventure-shell">
      <div class="adventure-screen" data-adventure-screen data-mode="town">
        <div class="adventure-background" data-background-id="town-square" aria-hidden="true">
          <img src="${assetUrl("backgrounds/landscape1.png")}" alt="" />
        </div>
        <section class="town-view" data-town-view aria-labelledby="town-title">
          <header class="town-heading">
            <p class="adventure-eyebrow" data-calendar>OUTPOST / TOWN</p>
            <h1 id="town-title">街の広場</h1>
            <p data-town-prompt>行き先を選ぶ</p>
            <div class="town-recovery" data-town-recovery role="status"></div>
            <p data-save-status role="status" hidden></p>
          </header>
          <nav class="town-places" data-town-places aria-label="街の場所"></nav>
          <div class="town-utility-controls">
            ${options?.party ? '<a class="dungeon-entry" href="#party-editor">出撃編成を見る</a>' : ""}
            ${options?.debug ? '<button type="button" class="battle-entry" data-save data-single-activation>保存</button><button type="button" class="battle-entry" data-load data-single-activation>読込</button>' : ""}
            ${options?.onHome ? '<button type="button" class="battle-entry" data-home data-single-activation>ホームへ戻る</button>' : ""}
            ${options?.debug ? '<a class="battle-entry" href="?debug=1&battle=1">戦闘デモを見る</a>' : ""}
            ${import.meta.env.DEV && options?.debug ? '<a class="adventure-editor-entry" href="?debug=1&adventureEdit=1">会話画面の配置設定</a>' : ""}
          </div>
          <section id="party-editor" class="party-editor" aria-label="出撃編成" data-party-editor></section>
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
  let actionId: number | null = null;
  let state = options?.initialState ?? createInitialGameState(initialGameOptions);
  const partyEditor = requiredElement<HTMLElement>(root, "[data-party-editor]");
  const partyEntry = root.querySelector<HTMLAnchorElement>(".dungeon-entry");
  function setPartyOpen(open: boolean) {
    if (open) disposeParty?.refresh();
    screen.classList.toggle("party-editing", open);
    partyEditor.hidden = !open;
    if (open) townView.removeAttribute("aria-labelledby");
    else townView.setAttribute("aria-labelledby", "town-title");
    if (open) partyEditor.querySelector<HTMLButtonElement>("[data-party-back]")?.focus();
    else partyEntry?.focus();
  }
  const disposeParty = options?.party ? mountPartyUi(partyEditor, options.party, () => setPartyOpen(false)) : undefined;
  partyEditor.hidden = true;
  partyEntry?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      setPartyOpen(true);
    },
    { signal: events.signal },
  );
  const shop = options?.shop ? mountItemShop(conversationView, options.shop) : undefined;
  let disposed = false;
  root.querySelector("[data-home]")?.addEventListener("click", () => options?.onHome?.(), { signal: events.signal });
  if (options?.debug) {
    const saveStatus = requiredElement<HTMLElement>(root, "[data-save-status]");
    saveStatus.textContent = options.saveMessage ?? "";
    saveStatus.hidden = !options.saveMessage;
    for (const [selector, action] of [
      ["[data-save]", options.save],
      ["[data-load]", options.load],
    ] as const) {
      if (!action) continue;
      requiredElement<HTMLButtonElement>(root, selector).addEventListener(
        "click",
        () => {
          const message = action();
          if (disposed) return;
          saveStatus.textContent = message;
          saveStatus.hidden = false;
        },
        { signal: events.signal },
      );
    }
  }
  applyAdventureSettings(screen, initialSettings);

  function performTownCommand(command: TownUiCommand, sourceActionId = actionId): void {
    const result: AdventureActionResult & { readonly recruitedNames?: readonly string[]; readonly actionId?: number } =
      options
        ? options.dispatch(command, sourceActionId)
        : command.type === "select"
          ? selectTownPlace(state, command.placeId, initialAdventure)
          : command.type === "advance"
            ? advanceConversation(state, initialAdventure)
            : chooseConversationOption(state, command.optionId, initialAdventure);

    if (result.accepted) {
      state = result.state;
      const prompt = requiredElement<HTMLElement>(root, "[data-town-prompt]");
      const names = result.recruitedNames;
      actionId = result.actionId ?? null;
      prompt.textContent = names?.length ? `${names.join("・")}が仲間に加わった。` : "行き先を選ぶ";
      render();
    }
  }

  function renderTown(): void {
    if (options) {
      requiredElement<HTMLElement>(root, "[data-calendar]").textContent = options.getCalendarLabel();
      const feedback = requiredElement<HTMLElement>(root, "[data-town-recovery]");
      feedback.replaceChildren(
        ...options.getFeedback().map((text) => {
          const line = document.createElement("p");
          line.textContent = text;
          return line;
        }),
      );
      feedback.hidden = feedback.childElementCount === 0;
    }
    const fragment = document.createDocumentFragment();
    for (const place of getAvailableTownPlaces(state, initialAdventure)) {
      const button = document.createElement("button");
      button.className = "town-place";
      button.type = "button";
      button.dataset.singleActivation = "";
      button.dataset.placeId = place.id;
      button.setAttribute("aria-label", place.label);

      const label = document.createElement("span");
      label.className = "town-place-label";
      label.textContent = place.label;
      const arrow = document.createElement("span");
      arrow.className = "town-place-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "›";
      button.append(label, arrow);
      button.addEventListener("click", () => performTownCommand({ type: "select", placeId: place.id }), {
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
      button.dataset.singleActivation = "";
      button.dataset.optionId = option.id;
      const marker = createTetrahedron();
      const number = document.createElement("span");
      number.className = "choice-number";
      number.textContent = String(index + 1);
      const label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = option.label;
      button.append(marker, number, label);
      const sourceActionId = actionId;
      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();
          performTownCommand({ type: "choose", optionId: option.id }, sourceActionId);
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
    shop?.render(state.mode === "conversation" && state.currentPlaceId === "market");
    if (disposed) return;
    if (state.mode === "town") {
      screen.dataset.mode = "town";
      screen.dataset.backgroundId = state.currentPlaceId;
      conversationView.hidden = true;
      townView.hidden = false;
      renderTown();
      const message = requiredElement<HTMLElement>(root, "[data-town-prompt]").textContent;
      status.textContent = message === "行き先を選ぶ" ? "街の場所を選べます" : message;
      return;
    }
    renderConversation();
    status.textContent = "会話中";
  }

  conversationStage.addEventListener(
    "click",
    (event) => {
      if ((event.target as Element).closest("button") !== null || event.detail > 1) return;
      const scene = getCurrentConversationScene(state, initialAdventure);
      if (scene?.type === "line") performTownCommand({ type: "advance" });
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
        performTownCommand({ type: "choose", optionId: option.id });
      } else if (event.code === "Space" && scene.type === "line") {
        event.preventDefault();
        performTownCommand({ type: "advance" });
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
      shop?.dispose();
      events.abort();
      disposeParty?.dispose();
    },
  };
}
