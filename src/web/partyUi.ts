import type { ExpeditionRejection, ExpeditionResult } from "../game/expedition";
import { type CharacterDefinition, characterById, departureRejection, type PartyState } from "../game/party";

import { canParticipate, effectiveMaxHp, healthyStatus } from "../game/status";
import { mountCharacterDetailsUi } from "./characterDetailsUi";
import { characterPortraitUrl } from "./characterPortrait";
import { symptomLabel } from "./sessionFeedback";

const rejectionText: Record<ExpeditionRejection, string> = {
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
  readonly getParty: () => PartyState;
  readonly getCalendarLabel: () => string;
  readonly edit: (slot: number, id: string | null) => ExpeditionResult;
  readonly depart: () => ExpeditionResult;
}

export function mountPartyUi(root: HTMLElement, options: PartyUiOptions, back: () => void) {
  root.innerHTML = `<header class="party-heading"><button class="party-back" type="button" data-party-back>戻る</button>
    <h2 id="party-title">出撃編成</h2><p class="party-calendar" data-party-calendar></p></header>
    <div class="party-slots" data-party-slots></div>
    <footer class="party-footer"><p data-party-status role="status" aria-live="polite"></p>
    <button class="party-depart" type="button" data-depart>出撃</button></footer>`;
  const slots = root.querySelector<HTMLElement>("[data-party-slots]");
  const status = root.querySelector<HTMLElement>("[data-party-status]");
  const depart = root.querySelector<HTMLButtonElement>("[data-depart]");
  const backButton = root.querySelector<HTMLButtonElement>("[data-party-back]");
  if (!slots || !status || !depart || !backButton) throw new Error("編成画面を作成できませんでした");
  const events = new AbortController();
  const details = mountCharacterDetailsUi(root, options.characters, options.getParty);
  backButton.addEventListener("click", back, { signal: events.signal });
  const selects = Array.from({ length: 4 }, (_, slot) => {
    const card = document.createElement("div");
    card.className = "party-slot";
    const label = document.createElement("label");
    label.className = "sr-only";
    label.textContent = `枠 ${slot + 1}`;
    label.htmlFor = `party-slot-${slot + 1}`;
    const portrait = document.createElement("div");
    portrait.className = "party-slot-portrait";
    portrait.setAttribute("aria-hidden", "true");
    const hp = document.createElement("p");
    hp.className = "party-slot-hp";
    const symptoms = document.createElement("p");
    symptoms.className = "party-slot-symptoms";
    const select = document.createElement("select");
    const detail = document.createElement("button");
    detail.type = "button";
    detail.className = "party-detail";
    detail.textContent = "詳細";
    detail.addEventListener(
      "click",
      () => {
        if (select.value) details.open(select.value, detail);
      },
      { signal: events.signal },
    );
    select.id = label.htmlFor;
    select.add(new Option("空き枠", ""));
    for (const member of options.getParty().members)
      select.add(new Option(characterById(options.characters, member.id).name, member.id));
    select.addEventListener(
      "change",
      () => {
        const result = options.edit(slot, select.value || null);
        render(result.accepted ? "" : rejectionText[result.reason]);
      },
      { signal: events.signal },
    );
    card.append(label, portrait, hp, select, symptoms, detail);
    slots.append(card);
    return { select, card, portrait, hp, symptoms, detail };
  });
  function render(message = "") {
    if (!status || !depart) return;
    const party = options.getParty();
    const calendar = root.querySelector<HTMLElement>("[data-party-calendar]");
    if (calendar) calendar.textContent = options.getCalendarLabel();
    selects.forEach(({ select, card, portrait, hp, symptoms, detail }, slot) => {
      const id = party.slots[slot];
      select.replaceChildren(
        new Option("空き枠", ""),
        ...party.members.map((member) => new Option(characterById(options.characters, member.id).name, member.id)),
      );
      select.value = id ?? "";
      for (const option of select.options) {
        const candidate = party.members.find((member) => member.id === option.value);
        if (!candidate) continue;
        const character = characterById(options.characters, candidate.id);
        option.text =
          candidate.id === id
            ? character.name
            : `${character.name} — HP ${candidate.hp}/${effectiveMaxHp(character.maxHp, candidate.status ?? healthyStatus())}${!canParticipate(candidate.hp, candidate.status) ? "・戦闘不能" : ""}`;
      }
      card.classList.toggle("is-occupied", id !== null);
      portrait.replaceChildren();
      const member = party.members.find((candidate) => candidate.id === id);
      if (member) {
        const character = characterById(options.characters, member.id);
        const url = characterPortraitUrl(member.id);
        if (url) {
          const image = document.createElement("img");
          image.className = "party-character-image";
          image.src = url;
          image.alt = "";
          portrait.append(image);
        } else {
          portrait.textContent = character.name;
        }
        hp.textContent = `HP ${member.hp} / ${effectiveMaxHp(character.maxHp, member.status ?? healthyStatus())}`;
        detail.hidden = false;
        detail.setAttribute("aria-label", `${character.name}の詳細`);
        symptoms.textContent = symptomLabel(member.status ?? healthyStatus());
        hp.classList.toggle("is-defeated", !canParticipate(member.hp, member.status));
      } else {
        detail.hidden = true;
        hp.textContent = "";
        symptoms.textContent = "";
        hp.classList.remove("is-defeated");
      }
      symptoms.hidden = symptoms.textContent.length === 0;
    });
    const reason = departureRejection(party);
    depart.disabled = reason !== null;
    status.textContent = [message, reason ? rejectionText[reason] : ""].filter(Boolean).join(" ");
    status.hidden = status.textContent.length === 0;
  }
  depart.addEventListener(
    "click",
    () => {
      const result = options.depart();
      if (!result.accepted) render(rejectionText[result.reason]);
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
