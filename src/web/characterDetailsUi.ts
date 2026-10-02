import { type CharacterDefinition, characterById, type PartyState } from "../game/party";
import { canParticipate, effectiveHitRate, effectiveMaxHp, healthyStatus } from "../game/status";
import { characterPortraitUrl } from "./characterPortrait";
import { requiredElement } from "./requiredElement";
import { formatAmount, mentalFatigueText, symptomLabel } from "./sessionFeedback";

export function mountCharacterDetailsUi(
  root: HTMLElement,
  characters: readonly CharacterDefinition[],
  getParty: () => PartyState,
) {
  const dialog = document.createElement("dialog");
  dialog.className = "character-details";
  dialog.setAttribute("aria-labelledby", "character-details-name");
  dialog.innerHTML = `<header class="character-details-heading">
    <button type="button" class="party-back" data-details-back>編成へ戻る</button>
    <h2 id="character-details-name"></h2></header>
    <div class="character-details-body"><div class="character-details-portrait" data-details-portrait></div>
    <div class="character-details-info" tabindex="0" role="region" aria-label="能力と状態"><dl class="character-details-stats" data-details-stats></dl>
    <p class="character-details-symptoms" data-details-symptoms></p>
    <p class="character-details-unavailable" data-details-unavailable></p></div></div>`;
  root.append(dialog);
  const name = requiredElement<HTMLElement>(dialog, "#character-details-name");
  const portrait = requiredElement<HTMLElement>(dialog, "[data-details-portrait]");
  const stats = requiredElement<HTMLElement>(dialog, "[data-details-stats]");
  const symptoms = requiredElement<HTMLElement>(dialog, "[data-details-symptoms]");
  const unavailable = requiredElement<HTMLElement>(dialog, "[data-details-unavailable]");
  const back = requiredElement<HTMLButtonElement>(dialog, "[data-details-back]");
  const events = new AbortController();
  let source: HTMLButtonElement | undefined;

  function close() {
    if (!dialog.open) return;
    dialog.close();
    if (source?.isConnected) source.focus({ preventScroll: true });
    source = undefined;
  }
  back.addEventListener("click", close, { signal: events.signal });
  dialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      close();
    },
    { signal: events.signal },
  );

  return {
    open(id: string, opener: HTMLButtonElement) {
      if (dialog.open) return;
      const member = getParty().members.find((candidate) => candidate.id === id);
      if (!member) return;
      const character = characterById(characters, id);
      const status = member.status ?? healthyStatus();
      name.textContent = character.name;
      portrait.replaceChildren();
      const url = characterPortraitUrl(id);
      if (url) {
        const image = document.createElement("img");
        image.className = "character-details-image";
        image.src = url;
        image.alt = character.name;
        portrait.append(image);
      }
      portrait.hidden = !url;
      const maxHp = effectiveMaxHp(character.maxHp, status);
      const baseHit = effectiveHitRate(character.hitRate, healthyStatus());
      const hit = effectiveHitRate(character.hitRate, status);
      const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`;
      stats.replaceChildren();
      for (const [label, value, reason] of [
        [
          "HP",
          `${formatAmount(member.hp)} / ${formatAmount(maxHp)}`,
          maxHp !== character.maxHp ? `基礎最大HP ${character.maxHp} · 肉体疲労による低下` : "",
        ],
        ["攻撃力", String(character.attackPower), ""],
        ["速度", String(character.speed), ""],
        ["命中率", percent(hit), hit !== baseHit ? `基礎 ${percent(baseHit)} · 朦朧による低下` : ""],
        ["精神疲労", mentalFatigueText(member.mentalFatigue ?? 0), ""],
      ]) {
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
      symptoms.textContent = symptomLabel(status);
      symptoms.hidden = !symptoms.textContent;
      unavailable.textContent = canParticipate(member.hp, status)
        ? ""
        : "戦闘に参加できません。街探索で回復を進められます。";
      unavailable.hidden = !unavailable.textContent;
      source = opener;
      dialog.showModal();
      back.focus();
    },
    dispose() {
      events.abort();
      if (dialog.open) dialog.close();
      source = undefined;
      dialog.remove();
    },
  };
}
