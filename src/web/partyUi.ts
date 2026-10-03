import type { ExpeditionRejection, ExpeditionResult } from "../game/expedition";
import { type CharacterDefinition, characterById, departureRejection, type PartyState } from "../game/party";
import { canParticipate, effectiveMaxHp, healthyStatus } from "../game/status";
import type { CharacterDetailsContext } from "./characterDetailsText";
import { mountCharacterDetailsUi } from "./characterDetailsUi";
import { characterPortraitUrl } from "./characterPortrait";
import { requiredElement } from "./requiredElement";
import { formatAmount, mentalFatigueText } from "./sessionFeedback";
import { renderSymptomIcons } from "./symptomIcons";
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
  readonly edit: (slot: number, id: string | null) => ExpeditionResult;
  readonly context?: "edit" | "departure";
  readonly depart?: () => ExpeditionResult;
}

export function mountPartyUi(root: HTMLElement, options: PartyUiOptions, back: () => void) {
  root.classList.add("ui-screen", "formation-screen");
  const departure = options.context !== "edit" && !!options.depart;
  root.innerHTML = `<header class="party-heading ui-heading">
    <h2 id="party-title" class="ui-title"></h2><p class="party-calendar" data-party-calendar></p>
    <p class="party-guidance">枠を選んで仲間を変更</p></header>
    <div class="party-workspace"><section class="party-candidates" aria-label="加入済みの仲間" hidden>
    <h3 data-selection-title>加入済みの仲間</h3><div class="party-candidate-grid" role="group" aria-label="候補一覧"></div></section>
    <div class="party-current"><div class="party-slots" data-party-slots></div>
    <section class="party-pending" aria-label="未確定の候補" hidden>
    <div class="party-preview" aria-hidden="true" data-pending-portrait></div>
    <div class="party-preview-info"><h3 data-pending-name></h3><p data-pending-summary></p>
    <div data-pending-symptoms></div><p data-pending-reason></p>
    <div class="party-pending-actions"><button type="button" class="party-detail ui-button" data-candidate-details>詳細</button>
    <button type="button" class="ui-button" data-remove>外す</button></div></div></section></div></div>
    <footer class="party-footer ui-actions"><button class="party-back ui-button ui-back" type="button" data-party-back>戻る</button>
    <p data-party-status role="status" aria-live="polite"></p>
    <button type="button" class="ui-button ui-primary" data-confirm>編成する</button>
    <button class="party-depart ui-button ui-primary" type="button" data-depart>出発する</button></footer>`;
  const slots = requiredElement<HTMLElement>(root, "[data-party-slots]");
  const status = requiredElement<HTMLElement>(root, "[data-party-status]");
  const depart = requiredElement<HTMLButtonElement>(root, "[data-depart]");
  const backButton = requiredElement<HTMLButtonElement>(root, "[data-party-back]");
  const candidates = requiredElement<HTMLElement>(root, ".party-candidates");
  const grid = requiredElement<HTMLElement>(root, ".party-candidate-grid");
  const pending = requiredElement<HTMLElement>(root, ".party-pending");
  const confirm = requiredElement<HTMLButtonElement>(root, "[data-confirm]");
  const remove = requiredElement<HTMLButtonElement>(root, "[data-remove]");
  const candidateDetails = requiredElement<HTMLButtonElement>(root, "[data-candidate-details]");
  const events = new AbortController();
  const details = mountCharacterDetailsUi(root, options.characters, options.getParty, options.getDetailsContext);
  // A second click must not activate the screen revealed by the first click.
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
  let editingSlot: number | null = null;
  let candidateId: string | null = null;

  function portrait(target: HTMLElement, id: string, face = false) {
    target.replaceChildren();
    const url = characterPortraitUrl(id, face);
    if (url) {
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
    } else target.textContent = "画像なし";
  }
  function memberHp(id: string) {
    const member = options.getParty().members.find((entry) => entry.id === id);
    if (!member) return "";
    const character = characterById(options.characters, id);
    return `HP ${formatAmount(member.hp)} / ${formatAmount(effectiveMaxHp(character.maxHp, member.status ?? healthyStatus()))}`;
  }
  const cards = Array.from({ length: 4 }, (_, slot) => {
    const card = document.createElement("div");
    card.className = "party-slot";
    card.innerHTML = `<button type="button" class="party-slot-choice ui-frame" aria-label="枠 ${slot + 1}" aria-describedby="party-slot-name-${slot} party-slot-hp-${slot} party-slot-state-${slot}">
      <span class="party-slot-portrait" aria-hidden="true"></span><span class="party-slot-name" id="party-slot-name-${slot}"></span>
      <span class="party-slot-hp" id="party-slot-hp-${slot}"></span></button><div class="party-slot-symptoms" id="party-slot-state-${slot}"></div>
      <button type="button" class="party-detail ui-button">詳細</button>`;
    const choice = requiredElement<HTMLButtonElement>(card, ".party-slot-choice");
    const detail = requiredElement<HTMLButtonElement>(card, ".party-detail");
    choice.addEventListener(
      "click",
      () => {
        editingSlot = slot;
        candidateId = options.getParty().slots[slot] ?? null;
        render();
        grid.scrollTop = 0;
        (
          grid.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
          grid.querySelector<HTMLButtonElement>("button")
        )?.focus();
      },
      { signal: events.signal },
    );
    detail.addEventListener(
      "click",
      () => {
        const id = options.getParty().slots[slot];
        if (id) details.open(id, detail);
      },
      { signal: events.signal },
    );
    slots.append(card);
    return { card, choice, detail };
  });
  function finish() {
    const slot = editingSlot;
    editingSlot = null;
    candidateId = null;
    render();
    if (slot !== null) cards[slot]?.choice.focus({ preventScroll: true });
  }
  function goBack() {
    if (editingSlot !== null) finish();
    else back();
  }
  backButton.addEventListener("click", goBack, { signal: events.signal });
  root.addEventListener(
    "keydown",
    (event) => {
      if (event.repeat && ["Enter", " ", "Escape"].includes(event.key)) {
        event.preventDefault();
        return;
      }
      if (event.key !== "Escape" || event.repeat || root.querySelector("dialog[open]")) return;
      event.preventDefault();
      event.stopPropagation();
      goBack();
    },
    { signal: events.signal },
  );
  function commit(id: string | null) {
    if (editingSlot === null) return;
    const result = options.edit(editingSlot, id);
    if (result.accepted) finish();
    else render(rejectionText[result.reason]);
  }
  confirm.addEventListener(
    "click",
    () => {
      if (!confirm.disabled && candidateId) commit(candidateId);
    },
    { signal: events.signal },
  );
  remove.addEventListener("click", () => commit(null), { signal: events.signal });
  candidateDetails.addEventListener(
    "click",
    () => {
      if (candidateId) details.open(candidateId, candidateDetails);
    },
    { signal: events.signal },
  );

  function renderPending() {
    const party = options.getParty();
    for (const button of grid.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute("aria-pressed", String(button.value === candidateId));
    }
    const member = party.members.find((entry) => entry.id === candidateId);
    const name = requiredElement<HTMLElement>(root, "[data-pending-name]");
    const summary = requiredElement<HTMLElement>(root, "[data-pending-summary]");
    const reason = requiredElement<HTMLElement>(root, "[data-pending-reason]");
    name.textContent = member ? characterById(options.characters, member.id).name : "仲間を選んでください";
    summary.textContent = "";
    const preview = requiredElement<HTMLElement>(root, "[data-pending-portrait]");
    preview.replaceChildren();
    if (member) portrait(preview, member.id);
    renderSymptomIcons(
      requiredElement<HTMLElement>(root, "[data-pending-symptoms]"),
      member?.status ?? healthyStatus(),
      member?.mentalFatigue ?? 0,
    );
    if (member) {
      summary.textContent = `${memberHp(member.id)} · 精神疲労 ${mentalFatigueText(member.mentalFatigue ?? 0)}`;
    }
    const duplicate = member && party.slots.some((id, slot) => id === member.id && slot !== editingSlot);
    reason.textContent = [
      duplicate ? "編成中。先に元の枠を空けてください。" : "",
      member && !canParticipate(member.hp, member.status) ? "戦闘参加不可。街探索で回復できます。" : "",
    ]
      .filter(Boolean)
      .join(" ");
    reason.hidden = !reason.textContent;
    candidateDetails.disabled = !member;
    confirm.disabled = !member || !!duplicate;
    confirm.textContent = editingSlot !== null && party.slots[editingSlot] ? "入れ替える" : "編成する";
    remove.hidden = editingSlot === null || !party.slots[editingSlot];
  }
  function render(message = "") {
    const party = options.getParty();
    root.classList.toggle("is-selecting", editingSlot !== null);
    candidates.hidden = editingSlot === null;
    pending.hidden = editingSlot === null;
    depart.hidden = editingSlot !== null || !departure;
    confirm.hidden = editingSlot === null;
    requiredElement<HTMLElement>(root, "#party-title").textContent =
      editingSlot !== null ? "仲間を選択" : departure ? "出発準備" : "編成";
    requiredElement<HTMLElement>(root, "[data-party-calendar]").textContent = options.getCalendarLabel();
    requiredElement<HTMLElement>(root, "[data-selection-title]").textContent = "加入済みの仲間";
    cards.forEach(({ card, choice, detail }, slot) => {
      const id = party.slots[slot];
      const member = party.members.find((entry) => entry.id === id);
      choice.value = id ?? "";
      choice.setAttribute("aria-pressed", String(slot === editingSlot));
      card.classList.toggle("is-occupied", !!member);
      const image = requiredElement<HTMLElement>(card, ".party-slot-portrait");
      const name = requiredElement<HTMLElement>(card, ".party-slot-name");
      const hp = requiredElement<HTMLElement>(card, ".party-slot-hp");
      const symptoms = requiredElement<HTMLElement>(card, ".party-slot-symptoms");
      image.replaceChildren();
      if (member) portrait(image, member.id, editingSlot !== null);
      else image.textContent = "+";
      name.textContent = member ? characterById(options.characters, member.id).name : "空き枠に追加";
      hp.textContent = member
        ? `${memberHp(member.id)}${!canParticipate(member.hp, member.status) ? " · 戦闘参加不可" : ""}`
        : "";
      hp.classList.toggle("is-defeated", !!member && !canParticipate(member.hp, member.status));
      renderSymptomIcons(symptoms, member?.status ?? healthyStatus(), member?.mentalFatigue ?? 0);
      detail.hidden = !member || editingSlot !== null;
      detail.setAttribute("aria-label", `${name.textContent}の詳細`);
    });
    const scroll = grid.scrollTop;
    const focusedCandidate = grid.contains(document.activeElement)
      ? (document.activeElement as HTMLButtonElement).value
      : null;
    grid.replaceChildren();
    if (editingSlot !== null)
      for (const member of party.members) {
        const character = characterById(options.characters, member.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "party-candidate ui-frame";
        button.value = member.id;
        button.setAttribute("aria-label", character.name);
        const face = document.createElement("span");
        face.className = "party-candidate-face";
        face.setAttribute("aria-hidden", "true");
        portrait(face, member.id, true);
        const name = document.createElement("span");
        name.textContent = character.name;
        const hp = document.createElement("span");
        hp.id = `party-candidate-hp-${grid.childElementCount}`;
        hp.textContent = memberHp(member.id);
        const state = document.createElement("span");
        state.className = "party-candidate-state";
        state.id = `party-candidate-state-${grid.childElementCount}`;
        button.setAttribute("aria-describedby", `${hp.id} ${state.id}`);
        state.textContent = [
          party.slots.includes(member.id) ? "編成中" : "",
          !canParticipate(member.hp, member.status) ? "戦闘不能" : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const info = document.createElement("span");
        info.className = "party-candidate-info";
        info.append(name, hp, state);
        button.append(face, info);
        button.addEventListener("click", () => {
          candidateId = member.id;
          renderPending();
        });
        grid.append(button);
      }
    grid.scrollTop = scroll;
    renderPending();
    if (focusedCandidate)
      Array.from(grid.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.value === focusedCandidate)
        ?.focus({ preventScroll: true });
    const reason = departureRejection(party);
    depart.disabled = reason !== null;
    status.textContent = [message, departure && editingSlot === null && reason ? rejectionText[reason] : ""]
      .filter(Boolean)
      .join(" ");
    status.hidden = !status.textContent;
  }
  depart.addEventListener(
    "click",
    () => {
      if (!departure || depart.disabled || editingSlot !== null) return;
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
      details.dispose();
    },
  };
}
