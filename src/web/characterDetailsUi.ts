import type { CharacterDetailsInteraction, CharacterDetailsModel } from "../presentation/characterDetails";
import { requiredElement } from "./requiredElement";
import "./party.css";

/** Paint the supplied model. Native elements and applied-focus bookkeeping stay in the view. */
export function createCharacterDetailsView(
  root: HTMLElement,
  send: (event: CharacterDetailsInteraction) => boolean,
  focusOpener: (characterId: string) => void,
) {
  const dialog = document.createElement("dialog");
  dialog.className = "character-details ui-dialog";
  dialog.setAttribute("aria-labelledby", "character-details-name");
  dialog.innerHTML = `<footer class="ui-actions"><button type="button" class="ui-button ui-back" data-details-back>編成へ戻る</button></footer>
    <header class="character-details-heading">
    <h2 class="ui-title" id="character-details-name"></h2>
    <p class="sr-only" id="character-details-scroll-hint">能力・習得はスクロールして確認</p></header>
    <div class="character-details-body"><div class="character-details-portrait" data-details-portrait></div>
    <div class="character-details-info" tabindex="0" role="region" aria-label="能力と状態" aria-describedby="character-details-scroll-hint"><dl class="character-details-stats" data-details-stats></dl>
    <p class="character-details-symptoms" data-details-symptoms></p>
    <p class="character-details-unavailable" data-details-unavailable></p>
    <section class="character-details-skills" aria-label="習得スキル" data-details-skills></section></div></div>`;
  root.append(dialog);
  const name = requiredElement<HTMLElement>(dialog, "#character-details-name");
  const portrait = requiredElement<HTMLElement>(dialog, "[data-details-portrait]");
  const stats = requiredElement<HTMLElement>(dialog, "[data-details-stats]");
  const symptoms = requiredElement<HTMLElement>(dialog, "[data-details-symptoms]");
  const unavailable = requiredElement<HTMLElement>(dialog, "[data-details-unavailable]");
  const back = requiredElement<HTMLButtonElement>(dialog, "[data-details-back]");
  const information = requiredElement<HTMLElement>(dialog, ".character-details-info");
  const body = requiredElement<HTMLElement>(dialog, ".character-details-body");
  // The unchanged responsive CSS scrolls the body on narrow screens and the information pane on desktop.
  const scrollOwner = () => (getComputedStyle(information).overflowY === "visible" ? body : information);
  const events = new AbortController();
  let paintedGeneration = -1;
  let appliedFocus: CharacterDetailsModel["focus"] = null;

  back.addEventListener("click", () => send({ type: "close" }), { signal: events.signal });
  back.addEventListener("focus", () => send({ type: "focused", target: { kind: "back" } }), { signal: events.signal });
  information.addEventListener("focus", () => send({ type: "focused", target: { kind: "information" } }), {
    signal: events.signal,
  });
  for (const node of [information, body])
    node.addEventListener(
      "scroll",
      () => {
        if (node === scrollOwner()) send({ type: "scrolled", scrollTop: node.scrollTop });
      },
      { signal: events.signal },
    );
  dialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      send({ type: "close" });
    },
    { signal: events.signal },
  );
  dialog.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "key", key: event.key, shift: event.shiftKey })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal: events.signal },
  );

  return {
    render(state: CharacterDetailsModel) {
      const frame = state.dialog;
      if (frame && paintedGeneration !== state.generation) {
        paintedGeneration = state.generation;
        name.textContent = frame.name;
        portrait.replaceChildren();
        const url = frame.portrait ? `${import.meta.env.BASE_URL}assets/${frame.portrait}` : undefined;
        if (url) {
          const image = document.createElement("img");
          image.className = "character-details-image";
          image.src = url;
          image.alt = frame.name;
          const generation = state.generation;
          image.addEventListener("error", () => send({ type: "portrait-failed", generation }), {
            once: true,
            signal: events.signal,
          });
          portrait.append(image);
        }
        portrait.hidden = !url;
        stats.replaceChildren();
        for (const [label, value, reason] of frame.stats) {
          const row = document.createElement("div");
          const term = document.createElement("dt");
          term.textContent = label;
          const description = document.createElement("dd");
          const number = document.createElement("span");
          number.textContent = value;
          description.append(number);
          row.append(term, description);
          if (reason) {
            const note = document.createElement("p");
            note.textContent = reason;
            description.append(note);
          }
          stats.append(row);
        }
        const skills = requiredElement<HTMLElement>(dialog, "[data-details-skills]");
        skills.replaceChildren();
        const title = document.createElement("h3");
        title.textContent = "習得スキル";
        skills.append(title);
        if (frame.skills.length === 0) {
          const empty = document.createElement("p");
          empty.textContent = frame.emptySkills;
          skills.append(empty);
        } else {
          for (const text of frame.skills) {
            const section = document.createElement("section");
            section.className = "character-details-skill";
            const heading = document.createElement("h4");
            heading.textContent = text.name;
            section.append(heading);
            for (const line of [text.kind, ...text.notes]) {
              const paragraph = document.createElement("p");
              paragraph.textContent = line;
              section.append(paragraph);
            }
            skills.append(section);
          }
        }
        symptoms.textContent = frame.symptoms;
        symptoms.hidden = !frame.symptoms;
        unavailable.textContent = frame.unavailable;
        unavailable.hidden = !frame.unavailable;
      }
      if (frame?.portraitFailed) portrait.textContent = "画像なし";
      if (frame && !dialog.open) dialog.showModal();
      if (!frame && dialog.open) dialog.close();
      scrollOwner().scrollTop = state.scrollTop;
      if (state.focus !== appliedFocus) {
        appliedFocus = state.focus;
        if (state.focus?.kind === "back") back.focus();
        if (state.focus?.kind === "information") information.focus();
        if (state.focus?.kind === "opener") focusOpener(state.focus.characterId);
      }
    },
    dispose() {
      events.abort();
      dialog.close();
      dialog.remove();
    },
  };
}
