import { initialBattleCombatants } from "../content/initialBattle";
import {
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  type BattleEvent,
  type BattleSkillRules,
  type BattleState,
  createBattleState,
  getBattleUpcomingActions,
  performBasicAttackAndAdvanceToAllyInput,
} from "../game/battle";
import { mentalFatigueMultiplier } from "../game/mentalFatigue";
import { activeSkillBaseAmount, mentalFatigueAffectedQuantity, skillById } from "../game/skills";
import { canParticipate, effectiveMaxHp } from "../game/status";
import type { BattlePresentation } from "./battlePresentation";
import { requiredElement } from "./requiredElement";
import { formatAmount, mentalFatigueText } from "./sessionFeedback";

const EVENT_TOAST_DURATION_MS = 650;
const ENEMY_TURN_PAUSE_MS = 360;

type Point3 = [number, number, number];

const TETRA_VERTICES: readonly Point3[] = [
  [0, -0.59, 1],
  [0.8660254, -0.59, -0.5],
  [-0.8660254, -0.59, -0.5],
  [0, 1.13, 0],
];
const TETRA_FACES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 3, 1],
  [1, 3, 2],
  [2, 3, 0],
];
const TETRA_FACE_COLORS = ["var(--face-top)", "var(--face-dark)", "var(--face-mid)", "var(--face-light)"];

/** SVG版の実3D四面体。面を奥行き順に重ね、CSSの平面回転による裏返りを防ぐ。 */
function createTetraMarkup(angle: number): string {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tilt = -0.18;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  const vertices = TETRA_VERTICES.map(([x, y, z]): Point3 => {
    const rotatedX = x * cos + z * sin;
    const rotatedZ = -x * sin + z * cos;
    return [rotatedX, y * cosTilt - rotatedZ * sinTilt, y * sinTilt + rotatedZ * cosTilt];
  });
  const projected: Point3[] = vertices.map(([x, y, z]) => [32 + x * 22, 29 + y * 24, z]);
  const coordinates = (ids: readonly number[]) =>
    ids.map((index) => `${projected[index][0].toFixed(3)},${projected[index][1].toFixed(3)}`).join(" ");
  const orderedFaces = TETRA_FACES.map((indices, index) => ({
    indices,
    index,
    depth: indices.reduce((sum, vertex) => sum + vertices[vertex][2], 0) / 3,
  })).sort((first, second) => first.depth - second.depth);
  const darkFaces = orderedFaces
    .map(
      (face) =>
        `<polygon points="${coordinates(face.indices)}" fill="var(--marker-body)" stroke="var(--marker-body)" stroke-width="7" stroke-linejoin="round"/>`,
    )
    .join("");
  const coloredFaces = orderedFaces
    .map((face) => {
      const engraving =
        face.index === 0
          ? ""
          : (() => {
              const tip = projected[3];
              const rim = face.indices.filter((index) => index !== 3).map((index) => projected[index]);
              if (rim.length !== 2) return "";
              return [0.35, 0.58]
                .map((amount) => {
                  const first = rim[0].map((value, index) => value * (1 - amount) + tip[index] * amount);
                  const second = rim[1].map((value, index) => value * (1 - amount) + tip[index] * amount);
                  const middleX = (first[0] + second[0]) / 2;
                  const middleY = (first[1] + second[1]) / 2;
                  return `<path d="M${first[0]},${first[1]} Q${middleX},${middleY + 2.2} ${second[0]},${second[1]}" fill="none" stroke="var(--text-secondary)" stroke-width=".85" opacity=".4"/>`;
                })
                .join("");
            })();
      return `<polygon points="${coordinates(face.indices)}" fill="${TETRA_FACE_COLORS[face.index]}" stroke="var(--marker-edge)" stroke-width="1.8" stroke-linejoin="round"/>${engraving}`;
    })
    .join("");
  return `${darkFaces}${coloredFaces}`;
}

const presentation: Record<string, { name: string; portrait?: string }> = {
  player: { name: "ロッシ", portrait: "characters/rossi/face.png" },
  gilberta: { name: "ギルベルタ", portrait: "characters/gilberta/face.png" },
  slime: { name: "スライム A", portrait: "enemies/slime-blue.png" },
  "slime-2": { name: "スライム B", portrait: "enemies/slime-blue.png" },
};

export type BattleUiAttackResult =
  | { readonly accepted: true; readonly state: BattleState; readonly events: readonly BattleEvent[] }
  | { readonly accepted: false; readonly reason: string };

export interface BattleUiOptions {
  readonly initialState?: BattleState;
  readonly skillRules?: BattleSkillRules;
  readonly useSkill?: (state: BattleState, actorId: string, targetId: string, skillId: string) => BattleUiAttackResult;
  readonly combatants?: readonly BattleCombatantDefinition[];
  readonly displayNames?: Readonly<Record<string, string>>;
  readonly attack?: (state: BattleState, actorId: string, targetId: string) => BattleUiAttackResult;
  readonly onFinish?: () => void;
  readonly finishButtonLabel?: string;
  readonly finishButtonAriaLabel?: string;
}

function createInitialBattle(): BattleState {
  return advanceBattleToNextAllyInput(createBattleState(initialBattleCombatants)).state;
}

function makeBattleMarkup(): string {
  return `
    <div class="battle-ui" data-battle-ui>
      <section class="timeline panel" aria-label="行動順">
        <ol class="queue" data-timeline aria-label="行動順。数値は次の行動までの整数tick"></ol>
      </section>
      <section class="commands panel" aria-labelledby="command-title">
        <h2 id="command-title">行動を選択</h2>
        <button class="command" type="button" data-attack>
          <svg class="attack-icon" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M11 23 25 5l2 1-3 9-11 11M8 19l9 8M9 25l-5 5M5 26l4 4" />
            <path d="m14 21 8-10" />
          </svg>
          <span>通常攻撃</span>
        </button>
        <button class="command" type="button" data-skills hidden>スキル</button>
        <div class="skill-panel" data-skill-panel hidden>
          <p data-skill-fatigue></p>
          <div data-skill-list></div>
          <p data-skill-preview></p>
          <label data-ally-label hidden>回復対象<select data-ally-target aria-label="回復対象"></select></label>
          <button class="command" type="button" data-use-skill>使用する</button>
          <button class="command" type="button" data-cancel-skill>戻る</button>
        </div>
        <p class="skill-result" data-skill-result hidden></p>
      </section>
      <section class="party" data-party aria-label="味方の状態"></section>
      <section class="battle-result panel" data-result role="status" aria-live="assertive" hidden>
        <h2 data-result-title></h2>
        <p data-result-detail></p>
        <button type="button" class="primary" data-rematch aria-label="戦闘を再戦する">再戦する</button>
      </section>
      <div class="event-toast" data-event-toast aria-hidden="true" hidden></div>
    </div>
    <div class="target-indicator" data-target-indicator aria-hidden="true" hidden>
      <svg class="tetra" viewBox="0 0 64 64" focusable="false">
        <g class="tetra-mesh" data-tetra-mesh></g>
      </svg>
    </div>
    <p class="sr-only" data-screen-reader-status role="status" aria-live="polite"></p>
  `;
}

export function mountBattleUi(
  board: HTMLDivElement,
  battle: BattlePresentation,
  options: BattleUiOptions = {},
): () => void {
  const initialCombatants = options.combatants ?? initialBattleCombatants;
  const combatantName = (id: string) => {
    const name = options.displayNames?.[id] ?? presentation[id]?.name ?? id;
    return presentation[id] === undefined &&
      initialCombatants.some((member) => member.id === id && member.team === "ally")
      ? `${name}（仮表示）`
      : name;
  };
  const portraitFor = (id: string) => presentation[id]?.portrait ?? "enemies/slime-blue.png";
  const findInitialCombatant = (id: string) => initialCombatants.find((initial) => initial.id === id);
  const teamFor = (id: string) => findInitialCombatant(id)?.team;
  const stageElement = board.querySelector<HTMLElement>(".stage");
  const canvas = board.querySelector<HTMLCanvasElement>("canvas");
  if (stageElement === null || canvas === null) throw new Error("戦闘画面の表示領域が見つかりません");
  const stage = stageElement;

  const events = new AbortController();
  const eventSignal = events.signal;
  let state = options.initialState ?? createInitialBattle();
  let selectedTargetId = getFrontmostLivingEnemyId(state);
  let skillPanelOpen = false;
  let selectedSkillId: string | null = null;
  let allyTargetId: string | null = null;
  let replayingEvents = false;
  let message = targetPrompt();
  let disposed = false;
  const animationWaits = new Map<number, () => void>();
  let markerFrame: number | undefined;
  let overlayFrame: number | undefined;
  let markerLastTime = 0;
  let markerAngle = 0.1;

  const hud = document.createElement("div");
  hud.innerHTML = makeBattleMarkup();
  board.append(hud);
  const battleUi = requiredElement<HTMLElement>(hud, "[data-battle-ui]");
  const timeline = requiredElement<HTMLOListElement>(hud, "[data-timeline]");
  const party = requiredElement<HTMLElement>(hud, "[data-party]");
  const skillsButton = requiredElement<HTMLButtonElement>(hud, "[data-skills]");
  const skillPanel = requiredElement<HTMLElement>(hud, "[data-skill-panel]");
  const skillList = requiredElement<HTMLElement>(hud, "[data-skill-list]");
  const skillFatigue = requiredElement<HTMLElement>(hud, "[data-skill-fatigue]");
  const skillPreview = requiredElement<HTMLElement>(hud, "[data-skill-preview]");
  const allyLabel = requiredElement<HTMLElement>(hud, "[data-ally-label]");
  const allyTarget = requiredElement<HTMLSelectElement>(hud, "[data-ally-target]");
  const useSkillButton = requiredElement<HTMLButtonElement>(hud, "[data-use-skill]");
  const cancelSkillButton = requiredElement<HTMLButtonElement>(hud, "[data-cancel-skill]");
  const skillResult = requiredElement<HTMLElement>(hud, "[data-skill-result]");
  if (options.skillRules) battleUi.classList.add("with-skills");
  const attackButton = requiredElement<HTMLButtonElement>(hud, "[data-attack]");
  const resultPanel = requiredElement<HTMLElement>(hud, "[data-result]");
  const resultTitle = requiredElement<HTMLHeadingElement>(hud, "[data-result-title]");
  const resultDetail = requiredElement<HTMLParagraphElement>(hud, "[data-result-detail]");
  const rematchButton = requiredElement<HTMLButtonElement>(hud, "[data-rematch]");
  const eventToast = requiredElement<HTMLDivElement>(hud, "[data-event-toast]");
  const targetIndicator = requiredElement<HTMLDivElement>(hud, "[data-target-indicator]");
  const tetraMesh = requiredElement<SVGGElement>(hud, "[data-tetra-mesh]");
  const screenReaderStatus = requiredElement<HTMLParagraphElement>(hud, "[data-screen-reader-status]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const enemyHitAreas = new Map<string, HTMLButtonElement>();
  const enemyNameplates = new Map<string, HTMLDivElement>();
  rematchButton.textContent = options.finishButtonLabel ?? "再戦する";
  rematchButton.setAttribute("aria-label", options.finishButtonAriaLabel ?? "戦闘を再戦する");
  screenReaderStatus.id = "battle-screen-reader-status";
  stage.append(targetIndicator, eventToast);

  for (const combatant of initialCombatants.filter((candidate) => candidate.team === "enemy")) {
    const nameplate = document.createElement("div");
    nameplate.className = "enemy-world-label";
    nameplate.dataset.enemyLabel = combatant.id;
    nameplate.setAttribute("role", "group");
    const heading = document.createElement("div");
    heading.className = "enemy-world-heading";
    const name = document.createElement("strong");
    name.dataset.enemyName = "";
    name.textContent = combatantName(combatant.id);
    const hp = document.createElement("span");
    hp.className = "enemy-world-hp";
    hp.dataset.enemyHp = "";
    const status = document.createElement("span");
    status.className = "enemy-world-state";
    status.dataset.enemyState = "";
    const hpTrack = makeHpBar(combatant.hp, combatant.hp);
    hpTrack.classList.add("enemy-world-track");
    heading.append(name, hp);
    nameplate.append(heading, status, hpTrack);
    stage.append(nameplate);
    enemyNameplates.set(combatant.id, nameplate);

    const button = document.createElement("button");
    const nameText = combatantName(combatant.id);
    button.type = "button";
    button.className = "enemy-hitbox";
    button.setAttribute("aria-label", `${nameText}を攻撃対象に選択`);
    button.setAttribute("aria-pressed", String(combatant.id === selectedTargetId));
    button.setAttribute("aria-describedby", screenReaderStatus.id);
    button.dataset.combatantId = combatant.id;
    stage.append(button);
    enemyHitAreas.set(combatant.id, button);

    button.addEventListener("click", () => selectTarget(combatant.id), { signal: eventSignal });
  }

  function getCombatant(id: string) {
    return state.combatants.find((combatant) => combatant.id === id);
  }

  function getFrontmostLivingEnemyId(source: BattleState): string | null {
    const livingEnemyIds = source.combatants
      .filter((combatant) => combatant.team === "enemy" && combatant.isAlive)
      .map((combatant) => combatant.id);
    return battle.getFrontmostEnemyId(livingEnemyIds) ?? null;
  }

  function targetPrompt(): string {
    return selectedTargetId === null
      ? "通常攻撃できる敵がいません。"
      : `対象：${combatantName(selectedTargetId)}。通常攻撃で攻撃します。敵をクリックすると対象を切り替えます。`;
  }

  function positionTargetMarker() {
    const id = selectedTargetId;
    const rect = id === null ? undefined : battle.getCombatantScreenRect(id);
    const nameplate = id === null ? undefined : enemyNameplates.get(id);
    if (
      !hasSelectedEnemy() ||
      id === null ||
      getCombatant(id)?.isAlive !== true ||
      rect === undefined ||
      nameplate === undefined ||
      nameplate.hidden
    ) {
      targetIndicator.hidden = true;
      return;
    }
    targetIndicator.style.left = `${rect.markerX}px`;
    targetIndicator.hidden = false;
    const nameplateTop = Number.parseFloat(nameplate.style.top) - nameplate.offsetHeight;
    const tetraSize = targetIndicator.offsetHeight;
    targetIndicator.style.top = `${Math.max(tetraSize + 4, nameplateTop - 4)}px`;
  }

  function separateMobileMarkerFromOtherLabel() {
    if (stage.clientWidth > 540 || targetIndicator.hidden || selectedTargetId === null) return;
    const marker = targetIndicator.getBoundingClientRect();
    for (const [id, nameplate] of enemyNameplates) {
      if (id === selectedTargetId || nameplate.hidden) continue;
      const label = nameplate.getBoundingClientRect();
      const overlapsHorizontally = label.left < marker.right && label.right > marker.left;
      const overlapsVertically = label.top < marker.bottom && label.bottom > marker.top;
      if (!overlapsHorizontally || !overlapsVertically) continue;

      // 小さい画面では選択外の札をターゲットマーカーより上へ逃がし、両方を読めるようにする。
      const shift = label.bottom - marker.top + 4;
      const currentTop = Number.parseFloat(nameplate.style.top);
      const topLimit = nameplate.offsetHeight + 4;
      nameplate.style.top = `${Math.max(topLimit, currentTop - shift)}px`;
    }
  }

  function positionEnemyOverlays(refreshScene: boolean) {
    if (disposed) return;
    if (refreshScene) battle.refreshCombatantScreenPositions();
    for (const [index, [id, button]] of [...enemyHitAreas.entries()].entries()) {
      const rect = battle.getCombatantScreenRect(id);
      const nameplate = enemyNameplates.get(id);
      if (nameplate === undefined) continue;
      if (rect === undefined) {
        button.hidden = true;
        nameplate.hidden = true;
        nameplate.dataset.spriteVisible = "false";
        continue;
      }
      button.hidden = false;
      nameplate.hidden = false;
      nameplate.dataset.spriteVisible = "true";
      button.style.left = `${rect.left}px`;
      button.style.top = `${rect.top}px`;
      button.style.width = `${rect.width}px`;
      button.style.height = `${rect.height}px`;
      const narrowScreenOffset = stage.clientWidth <= 540 && index === 0 ? 30 : 0;
      nameplate.style.left = `${rect.markerX}px`;
      nameplate.style.top = `${Math.max(8, rect.spriteTop - 8 - narrowScreenOffset)}px`;
      nameplate.dataset.spriteTop = String(rect.spriteTop);
    }
    positionTargetMarker();
    separateMobileMarkerFromOtherLabel();
  }

  function updateTargetHitAreas() {
    positionEnemyOverlays(true);
  }

  function renderTimeline() {
    const actions = getBattleUpcomingActions(state, 6);
    const fragment = document.createDocumentFragment();
    for (const [index, action] of actions.entries()) {
      const combatant = getCombatant(action.id);
      if (combatant === undefined) continue;
      const isCurrent = index === 0 && action.id === state.currentActorId;
      const ticks = Math.max(0, action.time - state.logicalTime);
      const row = document.createElement("li");
      row.className = `queue-row${isCurrent ? " current" : ""}${combatant.team === "enemy" ? " enemy" : ""}`;
      if (isCurrent) row.setAttribute("aria-current", "step");
      row.setAttribute(
        "aria-label",
        isCurrent ? combatantName(action.id) : `${combatantName(action.id)}、次の行動まで ${ticks} tick`,
      );
      const icon = document.createElement("span");
      icon.className = "queue-portrait";
      const imagePath = portraitFor(action.id);
      if (imagePath !== undefined) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = `${import.meta.env.BASE_URL}assets/${imagePath}`;
        icon.append(image);
      }
      const name = document.createElement("span");
      name.className = "queue-name";
      name.textContent = combatantName(action.id);
      if (!isCurrent) {
        const value = document.createElement("span");
        value.className = "queue-value";
        const number = document.createElement("b");
        number.textContent = String(ticks);
        value.append(number);
        row.append(icon, name, value);
      } else {
        row.append(icon, name);
      }
      fragment.append(row);
    }
    timeline.replaceChildren(fragment);
  }

  function makeHpBar(current: number, maximum: number): HTMLElement {
    const track = document.createElement("span");
    track.className = "hp-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.width = `${maximum === 0 ? 0 : (current / maximum) * 100}%`;
    track.append(fill);
    return track;
  }

  function renderCombatants() {
    const allyFragment = document.createDocumentFragment();
    for (const combatant of state.combatants) {
      if (combatant.team === "enemy") continue;
      const name = combatantName(combatant.id);
      const maximum = effectiveMaxHp(combatant.maxHp, combatant.status);
      const status = combatant.isAlive ? "" : "戦闘不能";
      const card = document.createElement("article");
      card.className = `ally-card${combatant.id === state.currentActorId ? " active" : ""}${combatant.isAlive ? "" : " defeated"}`;
      if (combatant.id === state.currentActorId) card.setAttribute("aria-current", "true");
      card.setAttribute(
        "aria-label",
        `${name}、HP ${formatAmount(combatant.hp)}/${maximum}${status ? `、${status}` : ""}`,
      );
      const image = document.createElement("img");
      image.className = "ally-portrait";
      image.alt = "";
      image.src = `${import.meta.env.BASE_URL}assets/${portraitFor(combatant.id) ?? ""}`;
      const details = document.createElement("div");
      details.className = "ally-details";
      const heading = document.createElement("div");
      heading.className = "ally-heading";
      const title = document.createElement("strong");
      title.textContent = name;
      const actorStatus = document.createElement("span");
      actorStatus.className = "ally-status";
      actorStatus.textContent = status || (combatant.id === state.currentActorId ? "" : "待機");
      heading.append(title, actorStatus);
      const hpLine = document.createElement("div");
      hpLine.className = "hp-line";
      const hpLabel = document.createElement("span");
      hpLabel.textContent = "HP";
      const hp = document.createElement("b");
      hp.textContent = `${formatAmount(combatant.hp)}`;
      const maximumLabel = document.createElement("span");
      maximumLabel.textContent = `/ ${maximum}`;
      hpLine.append(hpLabel, hp, maximumLabel);
      details.append(heading, hpLine, makeHpBar(combatant.hp, maximum));
      card.append(image, details);
      allyFragment.append(card);
    }
    party.replaceChildren(allyFragment);
  }

  function renderEnemyNameplates() {
    for (const [id, nameplate] of enemyNameplates) {
      const enemy = getCombatant(id);
      if (enemy === undefined) continue;
      const maximum = findInitialCombatant(id)?.hp ?? enemy.hp;
      const defeated = !enemy.isAlive;
      const status = requiredElement<HTMLElement>(nameplate, "[data-enemy-state]");
      const hp = requiredElement<HTMLElement>(nameplate, "[data-enemy-hp]");
      const bar = requiredElement<HTMLElement>(nameplate, ".enemy-world-track > span");
      nameplate.classList.toggle("defeated", defeated);
      nameplate.classList.toggle("selected", selectedTargetId === id);
      nameplate.setAttribute(
        "aria-label",
        `${combatantName(id)}、HP ${formatAmount(enemy.hp)}/${maximum}${defeated ? "、戦闘不能" : ""}`,
      );
      hp.textContent = `${formatAmount(enemy.hp)} / ${maximum}`;
      status.textContent = defeated ? "戦闘不能" : "";
      bar.style.width = `${maximum === 0 ? 0 : (enemy.hp / maximum) * 100}%`;
      const button = enemyHitAreas.get(id);
      button?.setAttribute(
        "aria-label",
        `${combatantName(id)}、HP ${formatAmount(enemy.hp)}/${maximum}${defeated ? "、戦闘不能" : ""}、攻撃対象に選択`,
      );
    }
  }

  function currentActorIsAlly(): boolean {
    if (state.outcome !== "ongoing" || state.currentActorId === null) return false;
    return getCombatant(state.currentActorId)?.team === "ally";
  }

  function hasSelectedEnemy(): boolean {
    return (
      selectedTargetId !== null &&
      getCombatant(selectedTargetId)?.isAlive === true &&
      state.outcome === "ongoing" &&
      !(skillPanelOpen && selectedSkill()?.target === "single-ally")
    );
  }

  function animateTetra(time: number) {
    if (disposed || reducedMotion.matches || !hasSelectedEnemy()) {
      markerFrame = undefined;
      markerLastTime = 0;
      return;
    }
    if (markerLastTime > 0) {
      markerAngle += (Math.min(time - markerLastTime, 64) / 1000) * ((Math.PI * 2) / 6);
    }
    markerLastTime = time;
    tetraMesh.innerHTML = createTetraMarkup(markerAngle);
    markerFrame = window.requestAnimationFrame(animateTetra);
  }

  function syncTetraAnimation() {
    const shouldAnimate = !reducedMotion.matches && hasSelectedEnemy() && !disposed;
    if (!shouldAnimate) {
      if (markerFrame !== undefined) window.cancelAnimationFrame(markerFrame);
      markerFrame = undefined;
      markerLastTime = 0;
      tetraMesh.innerHTML = createTetraMarkup(markerAngle);
      return;
    }
    if (markerFrame === undefined) {
      markerLastTime = 0;
      markerFrame = window.requestAnimationFrame(animateTetra);
    }
  }

  function render() {
    if (disposed) return;
    battleUi.dataset.replaying = String(replayingEvents);
    battleUi.dataset.selectedTarget = selectedTargetId ?? "";
    renderTimeline();
    renderCombatants();
    renderEnemyNameplates();
    screenReaderStatus.textContent = message;
    const canAct = currentActorIsAlly() && !replayingEvents;
    attackButton.disabled = !canAct || selectedTargetId === null;
    renderSkills(canAct);
    for (const [id, button] of enemyHitAreas) {
      const enemy = getCombatant(id);
      button.setAttribute("aria-pressed", String(id === selectedTargetId));
      button.disabled = replayingEvents || state.outcome !== "ongoing" || enemy?.isAlive !== true;
    }
    positionEnemyOverlays(false);
    syncTetraAnimation();
    const finished = state.outcome !== "ongoing" && !replayingEvents;
    resultPanel.hidden = !finished;
    rematchButton.hidden = !finished;
    resultTitle.textContent = state.outcome === "victory" ? "戦闘に勝利しました" : "戦闘に敗北しました";
    resultDetail.textContent =
      state.outcome === "victory" ? "敵をすべて倒しました。" : "味方が全員戦闘不能になりました。";
  }

  function animationWait(durationMs: number): Promise<void> {
    if (reducedMotion.matches) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        animationWaits.delete(timer);
        resolve();
      }, durationMs);
      animationWaits.set(timer, resolve);
    });
  }

  function finishDefeatPresentation(combatantId: string) {
    const button = enemyHitAreas.get(combatantId);
    const nameplate = enemyNameplates.get(combatantId);
    if (button !== undefined) button.hidden = true;
    if (nameplate !== undefined) {
      nameplate.hidden = true;
      nameplate.dataset.spriteVisible = "false";
    }
    positionTargetMarker();
  }

  function showEventToast(text: string, eventType: string) {
    eventToast.dataset.event = eventType;
    eventToast.textContent = text;
    eventToast.hidden = false;
    eventToast.classList.remove("play");
    // Reflow restarts the short presentation animation for consecutive events.
    void eventToast.offsetWidth;
    eventToast.classList.add("play");
  }

  async function replayEvents(confirmedEvents: readonly BattleEvent[]) {
    let hasReplayedAllyAttack = false;
    let hasPausedBeforeEnemyTurn = false;
    for (const event of confirmedEvents) {
      if (disposed) return;
      if (event.type === "miss") {
        const detail = `${combatantName(event.actorId)}の通常攻撃は外れた`;
        message = detail;
        showEventToast(detail, "attack");
        screenReaderStatus.textContent = detail;
        await animationWait(EVENT_TOAST_DURATION_MS);
      } else if (event.type === "attack") {
        const actorTeam = teamFor(event.actorId);
        if (actorTeam === "enemy" && hasReplayedAllyAttack && !hasPausedBeforeEnemyTurn) {
          eventToast.hidden = true;
          await animationWait(ENEMY_TURN_PAUSE_MS);
          if (disposed) return;
          hasPausedBeforeEnemyTurn = true;
        }
        if (actorTeam === "ally") hasReplayedAllyAttack = true;
        battle.playCombatantEffect(event.actorId, "attack", !reducedMotion.matches);
        battle.playCombatantEffect(event.targetId, "hit", !reducedMotion.matches);
        const detail = `${combatantName(event.actorId)}の通常攻撃！ ${combatantName(event.targetId)}に${event.damage}ダメージ`;
        message = detail;
        showEventToast(detail, "attack");
        screenReaderStatus.textContent = detail;
        await animationWait(EVENT_TOAST_DURATION_MS);
      } else if (event.type === "skill") {
        hasReplayedAllyAttack = true;
        const name = options.skillRules ? skillById(options.skillRules.catalog, event.skillId).name : event.skillId;
        const detail = `${name}：${combatantName(event.targetId)}に${formatAmount(event.amount)}${event.effect === "damage" ? "ダメージ" : "回復"}${event.hit ? "" : "（外れ）"} · 精神疲労 ${formatAmount(event.fatigueBefore)} → ${formatAmount(event.fatigueAfter)}`;
        skillResult.textContent = detail;
        skillResult.hidden = false;
        message = detail;
        showEventToast(detail, "attack");
        screenReaderStatus.textContent = detail;
        await animationWait(EVENT_TOAST_DURATION_MS);
      } else if (event.type === "combatant-defeated") {
        battle.playCombatantEffect(event.combatantId, "defeat", !reducedMotion.matches, () => {
          if (!disposed) finishDefeatPresentation(event.combatantId);
        });
        const detail = `${combatantName(event.combatantId)}は戦闘不能になった`;
        message = detail;
        showEventToast(detail, "defeat");
        screenReaderStatus.textContent = detail;
        await animationWait(EVENT_TOAST_DURATION_MS);
      } else {
        message = event.outcome === "victory" ? "戦闘に勝利しました" : "戦闘に敗北しました";
        showEventToast(message, "battle-ended");
        screenReaderStatus.textContent = message;
        await animationWait(EVENT_TOAST_DURATION_MS);
      }
    }
    if (disposed) return;
    eventToast.hidden = true;
    replayingEvents = false;
    message =
      state.outcome === "ongoing"
        ? targetPrompt()
        : state.outcome === "victory"
          ? "勝利です。再戦できます。"
          : "敗北です。再戦できます。";
    render();
  }

  function selectTarget(targetId: string) {
    if (replayingEvents || state.outcome !== "ongoing") return;
    const target = getCombatant(targetId);
    if (target === undefined || target.team !== "enemy" || !target.isAlive) return;
    // Selecting the active target again keeps it selected; there is no deselect state.
    selectedTargetId = targetId;
    message = `${combatantName(targetId)}を攻撃対象に選択しました。通常攻撃で攻撃します。`;
    render();
  }

  function attackSelectedTarget() {
    const actorId = state.currentActorId;
    const targetId = selectedTargetId;
    if (targetId === null || replayingEvents || actorId === null || !currentActorIsAlly()) return;
    const target = getCombatant(targetId);
    if (target === undefined || target.team !== "enemy" || !target.isAlive) return;
    replayingEvents = true;
    const result =
      options.attack?.(state, actorId, targetId) ?? performBasicAttackAndAdvanceToAllyInput(state, actorId, targetId);
    if (!result.accepted) {
      replayingEvents = false;
      message = `攻撃できませんでした：${result.reason}`;
      render();
      return;
    }
    state = result.state;
    if (selectedTargetId === null || getCombatant(selectedTargetId)?.isAlive !== true) {
      selectedTargetId = getFrontmostLivingEnemyId(state);
    }
    battleUi.dataset.selectedTarget = selectedTargetId ?? "";
    render();
    void replayEvents(result.events);
  }

  function selectedSkill() {
    if (!options.skillRules || !selectedSkillId) return undefined;
    const skill = skillById(options.skillRules.catalog, selectedSkillId);
    return skill.type === "active" ? skill : undefined;
  }

  function renderSkills(canAct: boolean) {
    const rules = options.skillRules;
    skillsButton.hidden = !rules || skillPanelOpen;
    skillsButton.disabled = !canAct;
    skillPanel.hidden = !skillPanelOpen || !canAct;
    attackButton.hidden = skillPanelOpen;
    if (!rules || !skillPanelOpen || !canAct) return;
    const actor = state.combatants.find((member) => member.id === state.currentActorId);
    if (!actor) return;
    skillFatigue.textContent = `精神疲労 ${mentalFatigueText(actor.mentalFatigue)} · 試用値`;
    skillList.replaceChildren();
    for (const known of actor.learnedSkills) {
      const definition = skillById(rules.catalog, known.skillId);
      if (definition.type !== "active" || !definition.scenes.includes("battle")) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command";
      button.textContent = definition.name;
      button.setAttribute("aria-pressed", String(selectedSkillId === definition.id));
      button.addEventListener("click", () => {
        selectedSkillId = definition.id;
        render();
        skillList.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
      });
      skillList.append(button);
    }
    const skill = selectedSkill();
    useSkillButton.disabled = !skill;
    allyLabel.hidden = skill?.target !== "single-ally";
    allyTarget.replaceChildren();
    for (const member of state.combatants.filter(
      (member) => member.team === actor.team && canParticipate(member.hp, member.status),
    )) {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${combatantName(member.id)} · HP ${formatAmount(member.hp)} / ${formatAmount(effectiveMaxHp(member.maxHp, member.status))}`;
      allyTarget.append(option);
    }
    if (!allyTargetId || ![...allyTarget.options].some((option) => option.value === allyTargetId))
      allyTargetId = actor.id;
    allyTarget.value = allyTargetId;
    if (!skill) {
      skillPreview.textContent = "使用するスキルを選択";
      return;
    }
    const multiplier = mentalFatigueAffectedQuantity(skill)
      ? mentalFatigueMultiplier(actor.mentalFatigue, rules.fatigue)
      : 1;
    const amount =
      activeSkillBaseAmount(skill, {
        attackPower: actor.attackPower,
        maxHp: effectiveMaxHp(actor.maxHp, actor.status),
      }) * multiplier;
    skillPreview.textContent = `${skill.description} 予測${skill.effect.type === "damage" ? "ダメージ" : "回復量"} ${formatAmount(amount)}（倍率 ${formatAmount(multiplier)}） · 使用後疲労 +${formatAmount(skill.mentalFatigueIncrease)}。命中・HP上限により実効果は変わります。`;
    if (skill.target === "single-enemy")
      skillPreview.textContent += ` 対象：${selectedTargetId ? combatantName(selectedTargetId) : "なし"}`;
  }

  function cancelSkill() {
    if (!skillPanelOpen || replayingEvents) return;
    skillPanelOpen = false;
    selectedSkillId = null;
    render();
    skillsButton.focus();
  }

  skillsButton.addEventListener(
    "click",
    () => {
      skillPanelOpen = true;
      selectedSkillId = null;
      render();
      skillList.querySelector<HTMLButtonElement>("button")?.focus();
    },
    { signal: eventSignal },
  );
  cancelSkillButton.addEventListener("click", cancelSkill, { signal: eventSignal });
  allyTarget.addEventListener(
    "change",
    () => {
      allyTargetId = allyTarget.value;
    },
    { signal: eventSignal },
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && skillPanelOpen) {
        event.preventDefault();
        cancelSkill();
      }
    },
    { signal: eventSignal },
  );
  useSkillButton.addEventListener(
    "click",
    () => {
      const actorId = state.currentActorId;
      const skill = selectedSkill();
      if (!actorId || !skill || replayingEvents || !currentActorIsAlly() || !options.useSkill) return;
      const targetId = skill.target === "single-ally" ? allyTargetId : selectedTargetId;
      if (!targetId) return;
      replayingEvents = true;
      const result = options.useSkill(state, actorId, targetId, skill.id);
      if (!result.accepted) {
        replayingEvents = false;
        message = `使用できませんでした：${result.reason}`;
        render();
        return;
      }
      state = result.state;
      skillPanelOpen = false;
      selectedSkillId = null;
      if (getCombatant(selectedTargetId ?? "")?.isAlive !== true) selectedTargetId = getFrontmostLivingEnemyId(state);
      render();
      void replayEvents(result.events);
    },
    { signal: eventSignal },
  );

  attackButton.addEventListener(
    "click",
    () => {
      attackSelectedTarget();
    },
    { signal: eventSignal },
  );

  rematchButton.addEventListener(
    "click",
    () => {
      if (state.outcome === "ongoing" || replayingEvents) return;
      if (options.onFinish !== undefined) {
        options.onFinish();
        return;
      }
      state = createInitialBattle();
      selectedTargetId = getFrontmostLivingEnemyId(state);
      replayingEvents = false;
      message = targetPrompt();
      battle.resetCombatantPresentation();
      render();
    },
    { signal: eventSignal },
  );

  reducedMotion.addEventListener("change", render, { signal: eventSignal });
  render();
  updateTargetHitAreas();
  // Projection and intrinsic text dimensions can settle in different layout passes.
  // Position changes do not resize these boxes; coalesce projection and DOM placement into one frame.
  const resizeObserver = new ResizeObserver(() => {
    if (disposed || overlayFrame !== undefined) return;
    overlayFrame = window.requestAnimationFrame(() => {
      overlayFrame = undefined;
      updateTargetHitAreas();
    });
  });
  resizeObserver.observe(stage);
  for (const nameplate of enemyNameplates.values()) resizeObserver.observe(nameplate);
  resizeObserver.observe(targetIndicator);

  return () => {
    disposed = true;
    for (const [timer, resolve] of animationWaits) {
      window.clearTimeout(timer);
      resolve();
    }
    animationWaits.clear();
    if (markerFrame !== undefined) window.cancelAnimationFrame(markerFrame);
    if (overlayFrame !== undefined) window.cancelAnimationFrame(overlayFrame);
    resizeObserver.disconnect();
    events.abort();
    for (const button of enemyHitAreas.values()) button.remove();
    for (const nameplate of enemyNameplates.values()) nameplate.remove();
    targetIndicator.remove();
    eventToast.remove();
    hud.remove();
  };
}
