import type { AdventureEvent } from "../presentation/adventureModel";
import type { AdventureFrame } from "../presentation/adventureProjection";
import { type AdventureSettings, applyAdventureSettings } from "./adventureSettings";
import { createPartyView } from "./partyView";
import { requiredElement } from "./requiredElement";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
function createTetrahedron(): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("choice-tetrahedron");
  icon.setAttribute("viewBox", "0 0 32 32");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = `<polygon points="30,16 4,3 4,29" fill="#394438" stroke="#f0b84a" stroke-width="1.5" /><path d="M30 16H4M4 3l12 13L4 29" fill="none" stroke="#f0b84a" stroke-width="1.2" />`;
  return icon;
}

/** Native nodes retain paint/application records; all game and screen choices arrive in the frame. */
export function createAdventureView(
  root: HTMLDivElement,
  utilities: AdventureFrame["utilities"],
  send: (event: AdventureEvent) => boolean,
  initialSettings: AdventureSettings,
) {
  root.innerHTML = `
    <main class="adventure-shell">
      <div class="adventure-screen" data-adventure-screen data-mode="town">
        <div class="adventure-background" data-background-id="town-square" aria-hidden="true"><img alt="" /></div>
        <section class="town-view" data-town-view aria-labelledby="town-title">
          <header class="town-heading">
            <p class="adventure-eyebrow" data-calendar>OUTPOST / TOWN</p><h1 id="town-title">街の広場</h1>
            <p data-town-prompt>行き先を選ぶ</p><div class="town-recovery" data-town-recovery role="status"></div><p data-save-status role="status" hidden></p>
          </header>
          <nav class="town-places" data-town-places aria-label="街の場所"></nav>
          <div class="town-utility-controls">
            ${utilities.party ? '<a class="dungeon-entry" href="#party-editor">出撃編成を見る</a>' : ""}
            ${utilities.debug ? '<button type="button" class="battle-entry" data-save>保存</button><button type="button" class="battle-entry" data-load>読込</button>' : ""}
            ${utilities.home ? '<button type="button" class="battle-entry" data-home>ホームへ戻る</button>' : ""}
            ${utilities.debug ? '<a class="battle-entry" href="?debug=1&battle=1">戦闘デモを見る</a>' : ""}
            ${utilities.editor ? '<a class="adventure-editor-entry" href="?debug=1&adventureEdit=1">会話画面の配置設定</a>' : ""}
          </div>
          <section id="party-editor" class="party-editor" aria-label="出撃編成" data-party-editor></section>
        </section>
        <section class="conversation-view" data-conversation-view aria-label="会話" hidden>
          <div class="conversation-stage" data-conversation-stage>
            <div class="conversation-portraits" data-conversation-portraits aria-hidden="true"></div>
            <div class="conversation-choices" data-conversation-choices aria-label="選択肢"></div>
            <div class="dialogue-panel" data-dialogue-panel aria-live="polite"><div class="dialogue-speaker" data-speaker></div><div class="dialogue-divider"></div><p class="dialogue-text" data-dialogue-text></p><span class="dialogue-next" data-dialogue-next aria-hidden="true"></span></div>
          </div>
        </section>
        <p class="sr-only" data-adventure-status role="status" aria-live="polite"></p>
      </div>
    </main>`;
  const events = new AbortController();
  const screen = requiredElement<HTMLDivElement>(root, "[data-adventure-screen]");
  const town = requiredElement<HTMLElement>(root, "[data-town-view]");
  const places = requiredElement<HTMLElement>(root, "[data-town-places]");
  const conversation = requiredElement<HTMLElement>(root, "[data-conversation-view]");
  const stage = requiredElement<HTMLElement>(root, "[data-conversation-stage]");
  const portraits = requiredElement<HTMLElement>(root, "[data-conversation-portraits]");
  const choices = requiredElement<HTMLElement>(root, "[data-conversation-choices]");
  const partyRoot = requiredElement<HTMLElement>(root, "[data-party-editor]");
  const partyEntry = root.querySelector<HTMLAnchorElement>(".dungeon-entry");
  let party: ReturnType<typeof createPartyView> | undefined;
  let placesPaint = "";
  let choicesPaint = "";
  let portraitsPaint = "";
  let appliedFocus: string | undefined;
  const placeElements = new Map<string, HTMLButtonElement>();
  const choiceElements = new Map<string, HTMLButtonElement>();
  partyEntry?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      send({ type: "open-party" });
    },
    { signal: events.signal },
  );
  partyEntry?.addEventListener("focus", () => send({ type: "focused", target: { kind: "party-entry" } }), {
    signal: events.signal,
  });
  for (const operation of ["home", "save", "load"] as const)
    root
      .querySelector(`[data-${operation}]`)
      ?.addEventListener("click", () => send({ type: operation }), { signal: events.signal });
  choices.addEventListener("click", (event) => event.stopPropagation(), { signal: events.signal });
  stage.addEventListener("click", () => send({ type: "advance" }), { signal: events.signal });
  window.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "key", code: event.code })) event.preventDefault();
    },
    { signal: events.signal },
  );
  const inputContext = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || target.matches("input, select, textarea"))
      ? ("text-entry" as const)
      : target instanceof HTMLElement && target.matches("button, a[href]")
        ? ("control" as const)
        : ("screen" as const);
  window.addEventListener("focusin", (event) => send({ type: "input-context", context: inputContext(event.target) }), {
    signal: events.signal,
  });
  window.addEventListener(
    "focusout",
    (event) => send({ type: "input-context", context: inputContext(event.relatedTarget) }),
    { signal: events.signal },
  );
  applyAdventureSettings(screen, initialSettings);
  return {
    conversationHost: conversation,
    render(frame: AdventureFrame) {
      const background = requiredElement<HTMLImageElement>(root, ".adventure-background img");
      const backgroundUrl = assetUrl(frame.backgroundPath);
      if (background.getAttribute("src") !== backgroundUrl) background.src = backgroundUrl;
      screen.dataset.mode = frame.mode;
      screen.dataset.backgroundId = frame.backgroundId;
      screen.classList.toggle("party-editing", frame.party !== undefined);
      partyRoot.hidden = frame.party === undefined;
      if (frame.party) town.removeAttribute("aria-labelledby");
      else town.setAttribute("aria-labelledby", "town-title");
      if (frame.party) {
        party ??= createPartyView(partyRoot, (event) => send({ type: "party", event }));
        party.render(frame.party);
      }
      town.hidden = frame.mode !== "town";
      conversation.hidden = frame.mode !== "conversation";
      requiredElement<HTMLElement>(root, "[data-calendar]").textContent = frame.calendar;
      requiredElement<HTMLElement>(root, "[data-town-prompt]").textContent = frame.prompt;
      const report = requiredElement<HTMLElement>(root, "[data-town-recovery]");
      report.replaceChildren(
        ...frame.feedback.map((text) => {
          const p = document.createElement("p");
          p.textContent = text;
          return p;
        }),
      );
      report.hidden = frame.feedback.length === 0;
      const saveStatus = requiredElement<HTMLElement>(root, "[data-save-status]");
      saveStatus.textContent = frame.saveStatus;
      saveStatus.hidden = frame.saveStatus === "";
      requiredElement<HTMLElement>(root, "[data-adventure-status]").textContent = frame.status;
      const nextPlacesPaint = JSON.stringify(frame.places);
      if (placesPaint !== nextPlacesPaint) {
        placesPaint = nextPlacesPaint;
        appliedFocus = undefined;
        placeElements.clear();
        places.replaceChildren(
          ...frame.places.map((place) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "town-place";
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
            button.addEventListener("click", () => send({ type: "select", placeId: place.id }), {
              signal: events.signal,
            });
            button.addEventListener(
              "focus",
              () => send({ type: "focused", target: { kind: "place", placeId: place.id } }),
              { signal: events.signal },
            );
            placeElements.set(place.id, button);
            return button;
          }),
        );
      }
      const scene = frame.scene;
      requiredElement<HTMLElement>(root, "[data-speaker]").textContent = scene?.speaker ?? "";
      requiredElement<HTMLElement>(root, "[data-dialogue-text]").textContent = scene?.text ?? "";
      requiredElement<HTMLElement>(root, "[data-dialogue-next]").hidden = scene?.type !== "line";
      stage.dataset.sceneType = scene?.type ?? "line";
      const nextPortraitsPaint = JSON.stringify(scene?.portraits ?? []);
      if (portraitsPaint !== nextPortraitsPaint) {
        portraitsPaint = nextPortraitsPaint;
        portraits.replaceChildren(
          ...(scene?.portraits ?? []).map((data) => {
            const figure = document.createElement("figure");
            figure.className = `conversation-portrait${data.speaking ? " is-speaking" : " is-muted"}`;
            figure.dataset.portraitId = data.id;
            figure.dataset.position = data.position;
            if (data.path) {
              const image = document.createElement("img");
              image.src = assetUrl(data.path);
              image.alt = "";
              image.decoding = "async";
              figure.append(image);
            }
            return figure;
          }),
        );
      }
      const nextChoicesPaint = JSON.stringify(scene?.choices ?? []);
      if (choicesPaint !== nextChoicesPaint) {
        choicesPaint = nextChoicesPaint;
        appliedFocus = undefined;
        choiceElements.clear();
        choices.replaceChildren(
          ...(scene?.choices ?? []).map((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "conversation-choice";
            button.dataset.optionId = option.id;
            const number = document.createElement("span");
            number.className = "choice-number";
            number.textContent = String(option.number);
            const label = document.createElement("span");
            label.className = "choice-label";
            label.textContent = option.label;
            button.append(createTetrahedron(), number, label);
            button.addEventListener("click", () => send({ type: "choose", optionId: option.id }), {
              signal: events.signal,
            });
            button.addEventListener(
              "focus",
              () => send({ type: "focused", target: { kind: "choice", optionId: option.id } }),
              { signal: events.signal },
            );
            choiceElements.set(option.id, button);
            return button;
          }),
        );
      }
      choices.hidden = !scene?.choices.length;
      const focus = frame.focus;
      const key = JSON.stringify(focus);
      if (key !== appliedFocus) {
        appliedFocus = key;
        if (focus?.kind === "place") placeElements.get(focus.placeId)?.focus();
        else if (focus?.kind === "choice") choiceElements.get(focus.optionId)?.focus();
        else if (focus?.kind === "party-entry") partyEntry?.focus();
      }
    },
    applySettings(settings: AdventureSettings) {
      applyAdventureSettings(screen, settings);
    },
    dispose() {
      events.abort();
      party?.dispose();
    },
  };
}
