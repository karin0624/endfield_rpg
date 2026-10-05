import type { PartyEvent, PartyFocus } from "../presentation/partyModel";
import type { PartyFrame } from "../presentation/partyProjection";
import { createCharacterDetailsView } from "./characterDetailsUi";
import { requiredElement } from "./requiredElement";
import "./party.css";

/** Native resources apply an explicit presentation frame; all interaction decisions belong to the model. */
export function createPartyView(root: HTMLElement, send: (event: PartyEvent) => boolean) {
  root.classList.add("ui-screen", "formation-screen");
  root.innerHTML = `<header class="party-heading"><h2 class="ui-title" data-party-title></h2>
    <p class="sr-only" data-party-calendar></p></header>
    <div class="party-workspace"><div class="party-slots" data-party-slots></div></div>
    <footer class="party-footer ui-actions"><button class="party-back ui-button ui-back" type="button" data-party-back>戻る</button>
    <p class="sr-only" id="party-status" role="status" aria-live="polite" data-party-status></p>
    <button class="party-depart ui-button ui-primary" type="button" aria-describedby="party-status" data-depart>出発する</button></footer>
    <dialog class="party-selection ui-dialog" aria-labelledby="party-selection-title">
    <header class="party-heading"><h2 class="ui-title" id="party-selection-title">仲間を選択</h2></header>
    <div class="party-candidates"><div class="party-candidate-grid" role="group" aria-label="候補一覧"></div></div>
    <footer class="party-footer ui-actions"><p class="sr-only" role="status" aria-live="polite" data-selection-status></p>
    <button type="button" class="ui-button ui-primary" data-confirm>確定</button></footer></dialog>`;
  const slots = requiredElement<HTMLElement>(root, "[data-party-slots]");
  const selection = requiredElement<HTMLDialogElement>(root, ".party-selection");
  const grid = requiredElement<HTMLElement>(root, ".party-candidate-grid");
  const depart = requiredElement<HTMLButtonElement>(root, "[data-depart]");
  const back = requiredElement<HTMLButtonElement>(root, "[data-party-back]");
  const confirm = requiredElement<HTMLButtonElement>(root, "[data-confirm]");
  const events = new AbortController();
  const slotButtons = new Map<number, HTMLButtonElement>();
  const candidateCards = new Map<string, HTMLElement>();
  let slotsPaint = "";
  let candidatesPaint = "";
  let appliedFocus: PartyFocus | null = null;
  const details = createCharacterDetailsView(
    root,
    (event) => send({ type: "details", event }),
    (id) => candidateCards.get(id)?.querySelector<HTMLButtonElement>(".party-detail")?.focus({ preventScroll: true }),
  );

  function bind(button: HTMLButtonElement, action: PartyEvent, focus: PartyFocus) {
    button.addEventListener("click", () => send(action), { signal: events.signal });
    button.addEventListener("focus", () => send({ type: "focused", target: focus }), { signal: events.signal });
  }
  bind(back, { type: "back" }, { kind: "back" });
  bind(depart, { type: "depart" }, { kind: "depart" });
  bind(confirm, { type: "confirm" }, { kind: "confirm" });
  grid.addEventListener("scroll", () => send({ type: "selection-scrolled", scrollTop: grid.scrollTop }), {
    signal: events.signal,
  });
  selection.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      send({ type: "confirm" });
    },
    { signal: events.signal },
  );
  root.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "key", key: event.key, shift: event.shiftKey })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal: events.signal },
  );

  function portrait(target: HTMLElement, path: string | undefined, id: string, generation: number) {
    if (!path) {
      target.textContent = "画像なし";
      return;
    }
    const image = document.createElement("img");
    image.className = "party-character-image";
    image.src = `${import.meta.env.BASE_URL}assets/${path}`;
    image.alt = "";
    image.addEventListener("error", () => send({ type: "portrait-failed", characterId: id, generation }), {
      once: true,
      signal: events.signal,
    });
    target.append(image);
  }
  function hpBar(ratio: number) {
    const bar = document.createElement("span");
    bar.className = "party-hp-bar";
    bar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("i");
    fill.style.width = `${ratio * 100}%`;
    bar.append(fill);
    return bar;
  }
  function focus(target: PartyFocus) {
    if (target.kind === "slot") slotButtons.get(target.slot)?.focus({ preventScroll: true });
    if (target.kind === "candidate")
      candidateCards.get(target.characterId)?.querySelector<HTMLButtonElement>(".party-candidate")?.focus();
    if (target.kind === "detail")
      candidateCards.get(target.characterId)?.querySelector<HTMLButtonElement>(".party-detail")?.focus();
    if (target.kind === "back") back.focus();
    if (target.kind === "depart") depart.focus();
    if (target.kind === "confirm") confirm.focus();
  }
  return {
    render(frame: PartyFrame) {
      root.hidden = !frame.visible;
      requiredElement(root, "[data-party-title]").textContent = frame.title;
      requiredElement(root, "[data-party-calendar]").textContent = frame.calendar;
      requiredElement(root, "[data-party-status]").textContent = frame.status;
      depart.hidden = !frame.departure.visible;
      depart.disabled = frame.departure.disabled;
      const newSlotsPaint = JSON.stringify([frame.portraitGeneration, frame.slots]);
      if (newSlotsPaint !== slotsPaint) {
        slotsPaint = newSlotsPaint;
        appliedFocus = null;
        slots.replaceChildren();
        slotButtons.clear();
        for (const { slot, member } of frame.slots) {
          const card = document.createElement("div");
          card.className = "party-slot";
          const choice = document.createElement("button");
          choice.type = "button";
          choice.className = "party-slot-choice";
          choice.dataset.slot = String(slot);
          choice.setAttribute("aria-label", `枠 ${slot + 1}`);
          choice.innerHTML = '<span class="party-slot-portrait" aria-hidden="true"></span>';
          if (member) {
            card.classList.add("is-occupied");
            portrait(
              requiredElement(choice, ".party-slot-portrait"),
              member.portrait,
              member.id,
              frame.portraitGeneration,
            );
            const name = document.createElement("span");
            name.className = "party-slot-name";
            name.textContent = member.name;
            const hp = document.createElement("span");
            hp.className = "party-slot-hp";
            hp.textContent = member.hp;
            const symptoms = document.createElement("span");
            symptoms.className = "party-slot-symptoms";
            symptoms.textContent = member.symptoms;
            choice.append(name, hpBar(member.ratio), hp, symptoms);
            choice.setAttribute("aria-description", `${member.name} ${member.hp} ${member.symptoms}`);
          } else {
            requiredElement(choice, ".party-slot-portrait").textContent = "+";
            choice.setAttribute("aria-description", "空き枠。仲間を選択");
          }
          bind(choice, { type: "open-selection", slot }, { kind: "slot", slot });
          slotButtons.set(slot, choice);
          card.append(choice);
          slots.append(card);
        }
      }
      const newCandidatesPaint = JSON.stringify([
        frame.portraitGeneration,
        frame.selection?.candidates.map(
          ({
            number: _number,
            unavailable: _unavailable,
            reason: _reason,
            selectionLabel: _selectionLabel,
            ...member
          }) => member,
        ),
      ]);
      if (frame.selection && newCandidatesPaint !== candidatesPaint) {
        candidatesPaint = newCandidatesPaint;
        appliedFocus = null;
        grid.replaceChildren();
        candidateCards.clear();
        frame.selection.candidates.forEach((member, index) => {
          const card = document.createElement("div");
          card.className = "party-candidate-card";
          card.innerHTML = `<button type="button" class="party-candidate" aria-describedby="candidate-hp-${index} candidate-state-${index} candidate-symptoms-${index}">
          <span class="party-candidate-face" aria-hidden="true"></span><span class="party-order" aria-hidden="true"></span>
          <span class="party-candidate-name"></span><span class="sr-only party-candidate-state" id="candidate-state-${index}"></span></button>
          <div class="party-candidate-info"><span class="party-candidate-hp" id="candidate-hp-${index}"></span>
          <button type="button" class="party-detail">詳細<span aria-hidden="true"> ›</span></button></div>
          <span class="party-candidate-symptoms" id="candidate-symptoms-${index}"></span>`;
          const choice = requiredElement<HTMLButtonElement>(card, ".party-candidate");
          choice.value = member.id;
          choice.setAttribute("aria-label", member.name);
          portrait(
            requiredElement(card, ".party-candidate-face"),
            member.portrait,
            member.id,
            frame.portraitGeneration,
          );
          requiredElement(card, ".party-candidate-name").textContent = member.name;
          requiredElement(card, ".party-candidate-hp").textContent = member.hp;
          requiredElement(card, ".party-candidate-info").append(hpBar(member.ratio));
          requiredElement(card, ".party-candidate-symptoms").textContent = member.symptoms;
          card.classList.toggle("has-symptoms", !!member.symptoms);
          bind(choice, { type: "toggle", characterId: member.id }, { kind: "candidate", characterId: member.id });
          const detail = requiredElement<HTMLButtonElement>(card, ".party-detail");
          detail.setAttribute("aria-label", `${member.name}の詳細`);
          bind(detail, { type: "show-details", characterId: member.id }, { kind: "detail", characterId: member.id });
          candidateCards.set(member.id, card);
          grid.append(card);
        });
      }
      if (frame.selection) {
        requiredElement(root, "[data-selection-status]").textContent = frame.selection.status;
        for (const member of frame.selection.candidates) {
          const card = candidateCards.get(member.id);
          if (!card) continue;
          const button = requiredElement<HTMLButtonElement>(card, ".party-candidate");
          card.classList.toggle("is-selected", member.number > 0);
          button.setAttribute("aria-pressed", String(member.number > 0));
          button.setAttribute("aria-disabled", String(member.unavailable));
          button.title = member.reason;
          button.setAttribute("aria-description", member.reason);
          requiredElement(card, ".party-order").textContent = member.number ? String(member.number) : "";
          requiredElement(card, ".party-candidate-state").textContent = member.selectionLabel;
        }
      }
      root.classList.toggle("is-selecting", !!frame.selection);
      if (frame.selection && !selection.open) selection.showModal();
      if (!frame.selection && selection.open) selection.close();
      if (frame.selection) grid.scrollTop = frame.selection.scrollTop;
      if (frame.focus !== appliedFocus) {
        appliedFocus = frame.focus;
        if (frame.focus && !frame.details.dialog) focus(frame.focus);
      }
      details.render(frame.details);
    },
    dispose() {
      events.abort();
      selection.close();
      details.dispose();
    },
  };
}
