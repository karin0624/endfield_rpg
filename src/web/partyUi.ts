import type { ExpeditionRejection, ExpeditionResult } from "../game/expedition";
import {
  type CharacterDefinition,
  characterById,
  departureRejection,
  type PartySlots,
  type PartyState,
} from "../game/party";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import type { CharacterDetailsContext } from "./characterDetailsText";
import { mountCharacterDetailsUi } from "./characterDetailsUi";
import { characterPortraitUrl } from "./characterPortrait";
import { togglePartySelection } from "./partySelection";
import { requiredElement } from "./requiredElement";
import { formatAmount, symptomDescriptions } from "./sessionFeedback";
import "./party.css";

const rejectionText: Record<ExpeditionRejection, string> = {
  "invalid-items": "持込み個数を確認してください。",
  "invalid-slot": "編成枠を選び直してください。",
  "not-joined": "加入済みの仲間を選んでください。",
  "duplicate-member": "同じ仲間は複数の枠に配置できません。先に元の枠を空けてください。",
  "empty-party": "出撃する仲間を1人以上選んでください。",
  "no-living-member": "出撃できる仲間がいません。街探索で回復を進められます。",
  "not-in-town": "編成と出撃は街で行ってください。",
  "action-in-progress": "現在の探索を終えてから出撃してください。",
  "not-on-route": "街へ戻れるのはルート選択中か探索終了後です。",
};

export interface PartyUiOptions {
  readonly characters: readonly CharacterDefinition[];
  readonly getDetailsContext?: () => CharacterDetailsContext;
  readonly getParty: () => PartyState;
  readonly getCalendarLabel: () => string;
  readonly confirm: (slots: PartySlots) => ExpeditionResult;
  readonly context?: "edit" | "departure";
  readonly depart?: () => ExpeditionResult;
}

export function mountPartyUi(root: HTMLElement, options: PartyUiOptions, back: () => void) {
  root.classList.add("ui-screen", "formation-screen");
  const departure = options.context !== "edit" && !!options.depart;
  root.innerHTML = `<header class="party-heading"><h2 class="ui-title">${departure ? "出発準備" : "編成"}</h2>
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
  const status = requiredElement<HTMLElement>(root, "[data-party-status]");
  const depart = requiredElement<HTMLButtonElement>(root, "[data-depart]");
  const selection = requiredElement<HTMLDialogElement>(root, ".party-selection");
  const grid = requiredElement<HTMLElement>(root, ".party-candidate-grid");
  const events = new AbortController();
  const details = mountCharacterDetailsUi(root, options.characters, options.getParty, options.getDetailsContext);
  let draft: PartySlots | null = null;
  let opener: HTMLButtonElement | null = null;
  let committing = false;
  for (const type of ["mousedown", "click"] as const)
    root.addEventListener(
      type,
      (event) => {
        if (event.detail <= 1) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { capture: true, signal: events.signal },
    );

  function portrait(target: HTMLElement, id: string) {
    const url = characterPortraitUrl(id);
    if (!url) {
      target.textContent = "画像なし";
      return;
    }
    const image = document.createElement("img");
    image.className = "party-character-image";
    image.src = url;
    image.alt = "";
    image.addEventListener(
      "error",
      () => {
        target.textContent = "画像なし";
      },
      { once: true },
    );
    target.append(image);
  }
  function memberInfo(id: string) {
    const member = options.getParty().members.find((entry) => entry.id === id);
    if (!member) throw new Error(`未加入のキャラクターです: ${id}`);
    const character = characterById(options.characters, id);
    const maxHp = effectiveMaxHp(character.maxHp, member.status ?? healthyStatus());
    return {
      name: character.name,
      hp: `HP ${formatAmount(member.hp)}/${formatAmount(maxHp)}`,
      ratio: maxHp > 0 ? Math.min(1, Math.max(0, member.hp / maxHp)) : 0,
      symptoms: symptomDescriptions(member.status ?? healthyStatus())
        .map(({ label }) => label)
        .join("　"),
    };
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
  function updateDraft() {
    for (const card of grid.querySelectorAll<HTMLElement>(".party-candidate-card")) {
      const button = requiredElement<HTMLButtonElement>(card, ".party-candidate");
      const number = (draft?.indexOf(button.value) ?? -1) + 1;
      card.classList.toggle("is-selected", number > 0);
      button.setAttribute("aria-pressed", String(number > 0));
      requiredElement<HTMLElement>(card, ".party-order").textContent = number ? String(number) : "";
      requiredElement<HTMLElement>(card, ".party-candidate-state").textContent = number ? `隊列 ${number}` : "未選択";
    }
  }
  function openSelection(button: HTMLButtonElement) {
    if (selection.open) return;
    opener = button;
    draft = [...options.getParty().slots];
    grid.replaceChildren();
    for (const member of options.getParty().members) {
      const info = memberInfo(member.id);
      const index = grid.childElementCount;
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
      choice.setAttribute("aria-label", info.name);
      portrait(requiredElement(card, ".party-candidate-face"), member.id);
      requiredElement(card, ".party-candidate-name").textContent = info.name;
      requiredElement(card, ".party-candidate-hp").textContent = info.hp;
      requiredElement(card, ".party-candidate-info").append(hpBar(info.ratio));
      requiredElement(card, ".party-candidate-symptoms").textContent = info.symptoms;
      card.classList.toggle("has-symptoms", !!info.symptoms);
      choice.addEventListener("click", () => {
        if (draft) {
          draft = togglePartySelection(draft, member.id);
          updateDraft();
        }
      });
      const detail = requiredElement<HTMLButtonElement>(card, ".party-detail");
      detail.setAttribute("aria-label", `${info.name}の詳細`);
      detail.addEventListener("click", () => details.open(member.id, detail));
      grid.append(card);
    }
    updateDraft();
    root.classList.add("is-selecting");
    selection.showModal();
    grid.scrollTop = 0;
  }
  function confirmSelection() {
    if (!draft || committing) return;
    committing = true;
    const result = options.confirm(draft);
    committing = false;
    if (!result.accepted) {
      requiredElement(root, "[data-selection-status]").textContent = rejectionText[result.reason];
      return;
    }
    draft = null;
    selection.close();
    root.classList.remove("is-selecting");
    const slot = opener?.dataset.slot;
    render();
    root.querySelector<HTMLButtonElement>(`[data-slot="${slot}"]`)?.focus({ preventScroll: true });
  }
  function render(message = "") {
    if (selection.open) return;
    slots.replaceChildren();
    options.getParty().slots.forEach((id, slot) => {
      const card = document.createElement("div");
      card.className = "party-slot";
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "party-slot-choice";
      choice.dataset.slot = String(slot);
      choice.setAttribute("aria-label", `枠 ${slot + 1}`);
      choice.innerHTML = '<span class="party-slot-portrait" aria-hidden="true"></span>';
      if (id) {
        const info = memberInfo(id);
        card.classList.add("is-occupied");
        portrait(requiredElement(choice, ".party-slot-portrait"), id);
        const name = document.createElement("span");
        name.className = "party-slot-name";
        name.textContent = info.name;
        const hp = document.createElement("span");
        hp.className = "party-slot-hp";
        hp.textContent = info.hp;
        const symptoms = document.createElement("span");
        symptoms.className = "party-slot-symptoms";
        symptoms.textContent = info.symptoms;
        choice.append(name, hpBar(info.ratio), hp, symptoms);
        choice.setAttribute("aria-description", `${info.name} ${info.hp} ${info.symptoms}`);
      } else {
        requiredElement(choice, ".party-slot-portrait").textContent = "+";
        choice.setAttribute("aria-description", "空き枠。仲間を選択");
      }
      choice.addEventListener("click", () => openSelection(choice));
      card.append(choice);
      slots.append(card);
    });
    requiredElement(root, "[data-party-calendar]").textContent = options.getCalendarLabel();
    const reason = departureRejection(options.getParty());
    depart.hidden = !departure;
    depart.disabled = reason !== null;
    status.textContent = message || (departure && reason ? rejectionText[reason] : "");
  }
  requiredElement(root, "[data-party-back]").addEventListener("click", back, { signal: events.signal });
  requiredElement(root, "[data-confirm]").addEventListener("click", confirmSelection, { signal: events.signal });
  selection.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      confirmSelection();
    },
    { signal: events.signal },
  );
  root.addEventListener(
    "keydown",
    (event) => {
      if (event.repeat && ["Enter", " ", "Escape"].includes(event.key)) {
        event.preventDefault();
        return;
      }
      if (event.key !== "Escape" || root.querySelector(".character-details[open]")) return;
      event.preventDefault();
      event.stopPropagation();
      if (selection.open) confirmSelection();
      else back();
    },
    { signal: events.signal },
  );
  depart.addEventListener(
    "click",
    () => {
      if (!departure || depart.disabled || selection.open) return;
      const result = options.depart?.();
      if (result && !result.accepted) render(rejectionText[result.reason]);
    },
    { signal: events.signal },
  );
  render();
  return {
    refresh: () => render(),
    dispose: () => {
      events.abort();
      selection.close();
      details.dispose();
    },
  };
}
