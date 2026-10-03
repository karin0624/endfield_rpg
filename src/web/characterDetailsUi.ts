import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import { type CharacterDefinition, characterById, type PartyState } from "../game/party";
import { canParticipate, effectiveHitRate, effectiveMaxHp, healthyStatus } from "../game/status";
import { type CharacterDetailsContext, characterLearning, learnedSkillText } from "./characterDetailsText";
import "./party.css";
import { characterPortraitUrl } from "./characterPortrait";
import { requiredElement } from "./requiredElement";
import { formatAmount, loadSymptomText, mentalFatigueText, symptomLabel } from "./sessionFeedback";

export function mountCharacterDetailsUi(
  root: HTMLElement,
  characters: readonly CharacterDefinition[],
  getParty: () => PartyState,
  getContext?: () => CharacterDetailsContext,
) {
  const dialog = document.createElement("dialog");
  dialog.className = "character-details ui-dialog";
  dialog.setAttribute("aria-labelledby", "character-details-name");
  dialog.innerHTML = `<footer class="ui-actions"><button type="button" class="ui-button ui-back" data-details-back>編成へ戻る</button></footer>
    <header class="character-details-heading">
    <h2 class="ui-title" id="character-details-name"></h2></header>
    <div class="character-details-body"><div class="character-details-portrait" data-details-portrait></div>
    <div class="character-details-info" tabindex="0" role="region" aria-label="能力と状態"><dl class="character-details-stats" data-details-stats></dl>
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
      const context = getContext?.();
      const character = characterById(context?.characters ?? characters, id);
      const base = context?.baseCharacters.find((entry) => entry.id === id);
      const learning = context ? characterLearning(id, context) : undefined;
      const status = member.status ?? healthyStatus();
      name.textContent = character.name;
      portrait.replaceChildren();
      const url = characterPortraitUrl(id);
      if (url) {
        const image = document.createElement("img");
        image.className = "character-details-image";
        image.src = url;
        image.alt = character.name;
        image.addEventListener(
          "error",
          () => {
            if (image.parentElement === portrait) portrait.textContent = "画像なし";
          },
          { once: true },
        );
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
          [
            base ? `基礎最大HP ${formatAmount(base.maxHp)}` : "",
            `症状前最大HP ${formatAmount(character.maxHp)}${context?.growth ? "（成長・パッシブ込み）" : ""}`,
            maxHp !== character.maxHp ? "肉体疲労による低下" : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        [
          "攻撃力",
          String(character.attackPower),
          base && base.attackPower !== character.attackPower
            ? `基礎 ${base.attackPower} · 成長・パッシブ込み（通常攻撃限定補正を除く）`
            : "",
        ],
        ["速度", String(character.speed), ""],
        ["命中率", percent(hit), hit !== baseHit ? `基礎 ${percent(baseHit)} · 朦朧による低下` : ""],
        ["レベル", learning?.level === undefined ? "未接続" : String(learning.level), ""],
        ["精神疲労", mentalFatigueText(member.mentalFatigue ?? 0), ""],
        ...(["physicalFatigue", "haze"] as const).map((kind) => [
          kind === "physicalFatigue" ? "肉体疲労" : "朦朧",
          loadSymptomText(kind, status[kind]),
          `上限 ${loadSymptomDefinition.symptoms[kind].cap} · 街探索1回につき ${loadSymptomDefinition.symptoms[kind].townRecovery} 回復`,
        ]),
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
      const skills = requiredElement<HTMLElement>(dialog, "[data-details-skills]");
      skills.replaceChildren();
      const title = document.createElement("h3");
      title.textContent = "習得スキル";
      skills.append(title);
      if (!context || learning?.learned === undefined || learning.learned.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = learning?.learned === undefined ? "習得情報は未接続です。" : "習得スキルなし";
        skills.append(empty);
      } else {
        for (const learned of learning.learned) {
          const text = learnedSkillText(context.rules.catalog, learned);
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
