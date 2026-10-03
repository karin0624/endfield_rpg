import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import type { ConversationPresentation } from "../game/adventure";
import type { BattleCombatantDefinition, BattleSkillRules, BattleState } from "../game/battle";
import {
  type DungeonActionResult,
  type DungeonState,
  getAvailableDungeonNodes,
  getCurrentDungeonConversationScene,
} from "../game/dungeon";
import type { DungeonCommand } from "../game/expedition";
import type { ExplorationSkills } from "../game/skillAcquisition";
import savedAdventureSettings from "./adventure-settings.json";
import { applyAdventureSettings, parseAdventureSettings } from "./adventureSettings";
import savedBattleSettings from "./battle-settings.json";
import type { DungeonBattleRenderer, DungeonBattleRendererFactory } from "./battlePresentation";
import { createBattleRenderer } from "./battleScene";
import { parseBattleSettings } from "./battleSettings";
import { mountBattleUi } from "./battleUi";
import { mountBranchSkillUi } from "./branchSkillUi";
import { mountGrowthChoice } from "./growthChoiceUi";
import { requiredElement } from "./requiredElement";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
const nodePositions: Readonly<Record<string, { x: number; y: number }>> = {
  "battle-a": { x: 34, y: 34 },
  "conversation-b": { x: 34, y: 66 },
  "boss-c": { x: 74, y: 50 },
};
type RouteNodeType = Exclude<(typeof initialDungeon.nodes)[number]["type"], "start">;
const nodePresentation = {
  battle: { title: "戦闘", icon: "battle" },
  conversation: { title: "思わぬ遭遇", icon: "encounter" },
  boss: { title: "ボス", icon: "boss" },
} as const satisfies Record<RouteNodeType, { readonly title: string; readonly icon: string }>;
const portraitAssets: Readonly<Record<string, string>> = {
  rossi: "characters/rossi/expressions/neutral.png",
  gilberta: "characters/gilberta/expressions/neutral.png",
};
const combatantNames: Readonly<Record<string, string>> = {
  player: "ロッシ",
  gilberta: "ギルベルタ",
  slime: "スライム A",
  "slime-2": "スライム B",
  "ruin-warden": "遺跡の守り手",
};

function portraitAssetPath(portraitId: string, expressionId: string | undefined): string | undefined {
  if (portraitAssets[portraitId] === undefined) return undefined;
  if (expressionId === "smile") return `characters/${portraitId}/expressions/smile.png`;
  return portraitAssets[portraitId];
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

function createChoiceMarker(): SVGSVGElement {
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

function toBattleDefinitions(state: BattleState): readonly BattleCombatantDefinition[] {
  return state.combatants.map((combatant) => ({
    id: combatant.id,
    team: combatant.team,
    speed: combatant.speed,
    hp: combatant.hp,
    attackPower: combatant.attackPower,
  }));
}

export function mountDungeonUi(
  root: HTMLDivElement,
  options: {
    initialState: DungeonState;
    getGrowth?: () => ExplorationSkills | undefined;
    chooseGrowth?: (input: {
      explorationId: string;
      characterId: string;
      level: number;
      skillId: string;
    }) => DungeonState | undefined;
    skillRules?: BattleSkillRules;
    calendarLabel: string;
    combatants: readonly BattleCombatantDefinition[];
    displayNames: Readonly<Record<string, string>>;
    dispatch: (command: DungeonCommand) => DungeonActionResult;
    onReturn: () => void;
    returnLabel?: string;
    createRenderer?: DungeonBattleRendererFactory;
  },
): () => void {
  root.innerHTML = `
    <main class="dungeon-app" data-dungeon-app>
      <section class="dungeon-route-screen" data-route-screen aria-label="遺跡の進路">
        <div class="dungeon-route-background" data-route-background aria-hidden="true">
          <img src="${assetUrl("backgrounds/dungeon-route.png")}" alt="" />
        </div>
        <button type="button" class="dungeon-town-link" data-return-town>${options.returnLabel ?? "街へ戻る"}</button>
        <p class="dungeon-calendar" data-calendar></p>
        <div class="dungeon-route-viewport" data-route-viewport tabindex="0" aria-label="横へドラッグして移動できる遺跡ルート">
          <div class="dungeon-route-world" data-route-world>
            <svg class="dungeon-route-edges" data-route-edges viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"></svg>
            <div class="dungeon-route-nodes" data-route-nodes aria-label="ルート上のノード"></div>
          </div>
        </div>
      </section>
      <section class="adventure-screen dungeon-conversation-screen" data-conversation-screen aria-label="遺跡の会話" hidden>
        <div class="adventure-background" data-conversation-background aria-hidden="true">
          <img src="${assetUrl("backgrounds/landscape1.png")}" alt="" />
        </div>
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
      <section class="dungeon-battle-screen" data-battle-screen aria-label="ダンジョン戦闘" hidden>
        <main class="battle-screen">
          <div class="game-board" data-board>
            <section class="stage" aria-label="ダンジョンの戦闘画面">
              <canvas aria-label="味方と敵の戦闘"></canvas>
              <div class="loading" role="status" data-status>戦闘画面を読み込んでいます…</div>
            </section>
          </div>
        </main>
      </section>
      <section class="dungeon-outcome-screen" data-outcome-screen aria-labelledby="dungeon-outcome-title" hidden>
        <p class="dungeon-eyebrow">EXPEDITION RESULT</p>
        <h1 id="dungeon-outcome-title" data-outcome-title></h1>
        <p data-outcome-detail></p>
        <button type="button" class="dungeon-outcome-return" data-return-town>${options.returnLabel ?? "街へ戻る"}</button>
      </section>
      <section data-growth-screen hidden></section>
      <p class="sr-only" data-dungeon-status role="status" aria-live="polite"></p>
    </main>
  `;

  const growthScreen = requiredElement<HTMLElement>(root, "[data-growth-screen]");
  let disposeGrowth: (() => void) | undefined;
  const routeScreen = requiredElement<HTMLElement>(root, "[data-route-screen]");
  requiredElement<HTMLElement>(root, "[data-calendar]").textContent = options.calendarLabel;
  const routeViewport = requiredElement<HTMLDivElement>(root, "[data-route-viewport]");
  const routeWorld = requiredElement<HTMLDivElement>(root, "[data-route-world]");
  const routeBackground = requiredElement<HTMLDivElement>(root, "[data-route-background]");
  const routeNodes = requiredElement<HTMLDivElement>(root, "[data-route-nodes]");
  const routeEdges = requiredElement<SVGSVGElement>(root, "[data-route-edges]");
  const conversationScreen = requiredElement<HTMLElement>(root, "[data-conversation-screen]");
  const conversationBackground = requiredElement<HTMLDivElement>(root, "[data-conversation-background]");
  const conversationStage = requiredElement<HTMLElement>(root, "[data-conversation-stage]");
  const portraits = requiredElement<HTMLElement>(root, "[data-conversation-portraits]");
  const choices = requiredElement<HTMLElement>(root, "[data-conversation-choices]");
  const speaker = requiredElement<HTMLElement>(root, "[data-speaker]");
  const dialogueText = requiredElement<HTMLParagraphElement>(root, "[data-dialogue-text]");
  const nextIndicator = requiredElement<HTMLSpanElement>(root, "[data-dialogue-next]");
  const battleScreen = requiredElement<HTMLElement>(root, "[data-battle-screen]");
  const battleBoard = requiredElement<HTMLDivElement>(root, "[data-board]");
  const battleCanvas = requiredElement<HTMLCanvasElement>(root, "canvas");
  const battleStatus = requiredElement<HTMLDivElement>(root, "[data-status]");
  const outcomeScreen = requiredElement<HTMLElement>(root, "[data-outcome-screen]");
  const outcomeTitle = requiredElement<HTMLHeadingElement>(root, "[data-outcome-title]");
  const outcomeDetail = requiredElement<HTMLParagraphElement>(root, "[data-outcome-detail]");
  const status = requiredElement<HTMLParagraphElement>(root, "[data-dungeon-status]");
  const events = new AbortController();
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-return-town]")) {
    button.addEventListener("click", options.onReturn, { signal: events.signal });
  }
  const settings = parseBattleSettings(savedBattleSettings);
  const conversationSettings = parseAdventureSettings(savedAdventureSettings);
  applyAdventureSettings(conversationScreen, conversationSettings);
  outcomeScreen.style.backgroundImage = `linear-gradient(180deg, #171d19d9, #171d19ee), url("${assetUrl("backgrounds/dungeon-route.png")}")`;
  let disposeBranchSkills: (() => void) | undefined;
  let branchResult = "";
  let dungeonState = options.initialState;
  let routeOffset = 0;
  let hasUserPannedRoute = false;
  let activePointerId: number | undefined;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let dragMoved = false;
  let suppressNextNodeClick = false;
  let battleRenderer: DungeonBattleRenderer | undefined;
  let battleScene: ReturnType<DungeonBattleRenderer["beginBattle"]> | undefined;
  let disposeBattleUi: (() => void) | undefined;
  let battleLoadId = 0;
  let edgeRefreshFrame: number | undefined;
  let disposed = false;
  const nodeButtons = new Map<string, HTMLButtonElement>();

  function showView(view: "route" | "conversation" | "battle" | "outcome" | "growth"): void {
    disposeBranchSkills?.();
    disposeBranchSkills = undefined;
    growthScreen.hidden = view !== "growth";
    routeScreen.hidden = view !== "route";
    conversationScreen.hidden = view !== "conversation";
    battleScreen.hidden = view !== "battle";
    outcomeScreen.hidden = view !== "outcome";
  }

  function routeStatus(nodeId: string, availableIds: ReadonlySet<string>): string {
    if (dungeonState.currentNodeId === nodeId) return "現在地";
    if (dungeonState.resolvedNodeIds.includes(nodeId)) return "踏破済み";
    if (availableIds.has(nodeId)) return "選択可能";
    return "未到達";
  }

  function isPastUnselectedNode(nodeId: string): boolean {
    return initialDungeon.nodes.some((source) => {
      const nextNodeIds: readonly string[] = [...source.nextNodeIds];
      return (
        dungeonState.resolvedNodeIds.includes(source.id) &&
        nextNodeIds.includes(nodeId) &&
        nextNodeIds.some(
          (siblingId) =>
            siblingId !== nodeId &&
            (dungeonState.currentNodeId === siblingId || dungeonState.resolvedNodeIds.includes(siblingId)),
        )
      );
    });
  }

  function renderEdges(availableIds: ReadonlySet<string>): void {
    const fragment = document.createDocumentFragment();
    const worldBounds = routeWorld.getBoundingClientRect();
    if (worldBounds.width === 0 || worldBounds.height === 0) return;

    function imageAnchor(nodeId: string, side: "left" | "right"): { x: number; y: number } | undefined {
      const button = nodeButtons.get(nodeId);
      const image = button?.querySelector("img");
      if (button === undefined || image === null || image === undefined) return undefined;
      const imageLeft = button.offsetLeft - button.offsetWidth / 2 + image.offsetLeft;
      const imageTop = button.offsetTop - button.offsetHeight / 2 + image.offsetTop;
      const edge = side === "right" ? imageLeft + image.offsetWidth + 10 : imageLeft - 10;
      return {
        x: (edge / worldBounds.width) * 1000,
        y: ((imageTop + image.offsetHeight / 2) / worldBounds.height) * 1000,
      };
    }

    for (const source of initialDungeon.nodes) {
      for (const targetId of source.nextNodeIds) {
        const target = initialDungeon.nodes.find((node) => node.id === targetId);
        if (target === undefined) continue;
        const sourceAnchor = imageAnchor(source.id, "right");
        const targetAnchor = imageAnchor(targetId, "left");
        if (sourceAnchor === undefined || targetAnchor === undefined) continue;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("dungeon-route-edge");
        const selected =
          dungeonState.resolvedNodeIds.includes(source.id) && dungeonState.resolvedNodeIds.includes(targetId);
        const reachable = source.id === dungeonState.currentNodeId && availableIds.has(targetId);
        if (selected) path.classList.add("is-resolved");
        else if (reachable) path.classList.add("is-available");
        else path.classList.add("is-unavailable");
        path.dataset.edgeFrom = source.id;
        path.dataset.edgeTo = targetId;
        const handle = (targetAnchor.x - sourceAnchor.x) * 0.45;
        path.setAttribute(
          "d",
          `M ${sourceAnchor.x} ${sourceAnchor.y} C ${sourceAnchor.x + handle} ${sourceAnchor.y}, ${targetAnchor.x - handle} ${targetAnchor.y}, ${targetAnchor.x} ${targetAnchor.y}`,
        );
        fragment.append(path);
      }
    }
    routeEdges.replaceChildren(fragment);
  }

  function scheduleEdgeRefresh(): void {
    if (edgeRefreshFrame !== undefined) cancelAnimationFrame(edgeRefreshFrame);
    edgeRefreshFrame = requestAnimationFrame(() => {
      edgeRefreshFrame = undefined;
      if (routeScreen.hidden) return;
      const availableIds = new Set(getAvailableDungeonNodes(dungeonState, initialDungeon).map((node) => node.id));
      renderEdges(availableIds);
    });
  }

  function clampRouteOffset(offset: number): number {
    const centers = [...routeNodes.querySelectorAll<HTMLButtonElement>(".dungeon-route-node")].map(
      (button) => button.offsetLeft,
    );
    if (centers.length === 0) return 0;
    const viewportCenter = routeViewport.clientWidth / 2;
    const minCenter = Math.min(...centers);
    const maxCenter = Math.max(...centers);
    const leftLimit = viewportCenter - maxCenter;
    const rightLimit = viewportCenter - minCenter;
    return Math.min(rightLimit, Math.max(leftLimit, offset));
  }

  function setRouteOffset(offset: number): void {
    routeOffset = clampRouteOffset(offset);
    routeWorld.style.transform = `translate3d(${routeOffset}px, 0, 0)`;
    routeBackground.style.transform = `translate3d(${routeOffset * 0.42}px, 0, 0)`;
    routeViewport.dataset.routeOffset = String(Math.round(routeOffset));
  }

  function centerRouteForCurrentProgress(): void {
    const accessibleIds = [
      dungeonState.currentNodeId,
      ...getAvailableDungeonNodes(dungeonState, initialDungeon).map((node) => node.id),
    ];
    const centers = accessibleIds.flatMap((nodeId) => {
      const node = nodeButtons.get(nodeId);
      return node === undefined ? [] : [node.offsetLeft];
    });
    if (centers.length === 0) return;
    const groupCenter = (Math.min(...centers) + Math.max(...centers)) / 2;
    setRouteOffset(routeViewport.clientWidth / 2 - groupCenter);
  }

  function renderRoute(): void {
    showView("route");
    hasUserPannedRoute = false;
    const available = getAvailableDungeonNodes(dungeonState, initialDungeon);
    const availableIds = new Set(available.map((node) => node.id));
    const fragment = document.createDocumentFragment();
    nodeButtons.clear();

    for (const node of initialDungeon.nodes) {
      if (node.type === "start") continue;
      const position = nodePositions[node.id];
      if (position === undefined) continue;
      const presentation = nodePresentation[node.type];
      const current = dungeonState.currentNodeId === node.id;
      const canSelect = availableIds.has(node.id);
      const stateLabel = routeStatus(node.id, availableIds);
      const resolved = dungeonState.resolvedNodeIds.includes(node.id);
      const pastUnselected = !current && !canSelect && !resolved && isPastUnselectedNode(node.id);
      const button = document.createElement("button");
      button.className = `dungeon-route-node type-${node.type}${current ? " is-current" : ""}${canSelect ? " is-available" : ""}${pastUnselected ? " is-past-unselected" : ""}${resolved ? " is-resolved" : ""}`;
      button.type = "button";
      button.disabled = !canSelect;
      button.style.left = `${position.x}%`;
      button.style.top = `${position.y}%`;
      button.dataset.nodeId = node.id;
      button.dataset.nodeType = node.type;
      button.dataset.nodeState = stateLabel;
      button.setAttribute("aria-label", `${presentation.title}、${stateLabel}`);
      if (current) button.setAttribute("aria-current", "location");

      const icon = document.createElement("img");
      icon.src = assetUrl(`dungeon-nodes/${canSelect ? "focus" : "unfocus"}/${presentation.icon}.png`);
      icon.alt = "";
      icon.draggable = false;
      icon.decoding = "async";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      if (!pastUnselected) {
        const label = document.createElement("span");
        label.className = "dungeon-route-node-label";
        label.textContent = presentation.title;
        button.append(label);
      }
      button.addEventListener(
        "click",
        () => {
          if (suppressNextNodeClick) {
            suppressNextNodeClick = false;
            return;
          }
          const result = options.dispatch({ type: "enter", nodeId: node.id });
          applyDungeonResult(result);
        },
        { signal: events.signal },
      );
      nodeButtons.set(node.id, button);
      fragment.append(button);
    }
    routeNodes.replaceChildren(fragment);
    renderEdges(availableIds);
    requestAnimationFrame(() => {
      if (!hasUserPannedRoute) centerRouteForCurrentProgress();
    });
    if (options.skillRules)
      disposeBranchSkills = mountBranchSkillUi(
        routeScreen,
        dungeonState,
        options.skillRules,
        options.displayNames,
        options.dispatch,
        (result) => {
          if (result.accepted) {
            const used = result.events.find((event) => event.type === "skill");
            branchResult =
              used?.type === "skill"
                ? `HPを${Number(used.amount.toFixed(2))}回復。精神疲労 ${used.fatigueBefore} → ${used.fatigueAfter}。`
                : "";
            for (const event of result.events)
              if (event.type === "symptom")
                branchResult += `${event.kind === "physicalFatigue" ? "肉体疲労" : "朦朧"} ${event.before} → ${event.after}。`;
          }
          applyDungeonResult(result);
          routeScreen.querySelector<HTMLButtonElement>(".branch-skill-trigger")?.focus();
        },
      );
    let resultLabel = routeScreen.querySelector<HTMLParagraphElement>(".branch-skill-result");
    if (!resultLabel) {
      resultLabel = document.createElement("p");
      resultLabel.className = "branch-skill-result";
      resultLabel.setAttribute("role", "status");
      routeScreen.append(resultLabel);
    }
    resultLabel.textContent = branchResult;
    status.textContent = `現在地: ${initialDungeon.nodes.find((node) => node.id === dungeonState.currentNodeId)?.label ?? "不明"}`;
  }

  function renderPortraits(conversationId: string, presentation: ConversationPresentation): void {
    const cast = getPortraitCast(conversationId);
    const fragment = document.createDocumentFragment();
    for (const [portraitId, initialPresentation] of cast) {
      const currentSpeaker = presentation.portraitId === portraitId;
      const portrait = document.createElement("figure");
      portrait.className = `conversation-portrait${currentSpeaker ? " is-speaking" : " is-muted"}`;
      portrait.dataset.portraitId = portraitId;
      portrait.dataset.position = (currentSpeaker ? presentation.position : initialPresentation.position) ?? "center";
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
    portraits.replaceChildren(fragment);
  }

  function renderChoices(
    scene: Extract<NonNullable<ReturnType<typeof getCurrentDungeonConversationScene>>, { type: "choice" }>,
  ): void {
    const fragment = document.createDocumentFragment();
    scene.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "conversation-choice";
      button.type = "button";
      button.dataset.optionId = option.id;
      const marker = createChoiceMarker();
      const number = document.createElement("span");
      number.className = "choice-number";
      number.textContent = String(index + 1);
      const label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = option.label;
      button.append(marker, number, label);
      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();
          applyDungeonResult(options.dispatch({ type: "choose", optionId: option.id }));
        },
        { signal: events.signal },
      );
      fragment.append(button);
    });
    choices.replaceChildren(fragment);
    choices.hidden = scene.options.length === 0;
  }

  function renderConversation(): void {
    const scene = getCurrentDungeonConversationScene(dungeonState, initialAdventure);
    if (scene === null) {
      renderRoute();
      return;
    }
    showView("conversation");
    conversationBackground.dataset.backgroundId = scene.presentation.backgroundId ?? "roadside";
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

  function disposeBattle(): void {
    battleLoadId += 1;
    disposeBattleUi?.();
    disposeBattleUi = undefined;
    battleScene?.dispose();
    battleScene = undefined;
  }

  function renderGrowth(): boolean {
    const growth = options.getGrowth?.();
    if (!growth?.choice || !options.skillRules || !options.chooseGrowth) return false;
    disposeBattle();
    showView("growth");
    disposeGrowth?.();
    disposeGrowth = mountGrowthChoice(
      growthScreen,
      growth,
      options.skillRules.catalog,
      options.displayNames,
      (input) => {
        const updated = options.chooseGrowth?.(input);
        if (updated) dungeonState = updated;
        if (!renderGrowth()) renderRoute();
      },
    );
    return true;
  }

  function renderOutcome(): void {
    disposeBattle();
    showView("outcome");
    const cleared = dungeonState.outcome === "cleared";
    outcomeTitle.textContent = cleared ? "探索を完了しました" : "探索に失敗しました";
    outcomeDetail.textContent = cleared ? "遺跡の守り手を倒し、探索を終えました。" : "味方が全員戦闘不能になりました。";
    status.textContent = outcomeTitle.textContent;
  }

  function startBattle(state: DungeonState): void {
    const activity = state.activity;
    if (activity?.type !== "battle") {
      renderRoute();
      return;
    }
    disposeBattle();
    const currentLoadId = battleLoadId;
    const definitions = toBattleDefinitions(activity.state);
    const node = initialDungeon.nodes.find((candidate) => candidate.id === state.activeNodeId);
    const labelDefinitions = [
      ...options.combatants,
      ...(node?.type === "battle" || node?.type === "boss" ? node.enemies : []),
    ];
    battleStatus.hidden = false;
    battleStatus.classList.remove("sr-only");
    battleStatus.textContent = "戦闘画面を読み込んでいます…";
    showView("battle");
    battleRenderer ??= (options.createRenderer ?? createBattleRenderer)(battleCanvas, settings);
    battleScene = battleRenderer.beginBattle(definitions);
    const currentScene = battleScene;
    void currentScene.ready
      .then(() => {
        if (disposed || currentLoadId !== battleLoadId || battleScene !== currentScene) return;
        battleCanvas.dataset.ready = "true";
        battleStatus.textContent = "表示準備完了";
        battleStatus.classList.add("sr-only");
        disposeBattleUi = mountBattleUi(battleBoard, currentScene, {
          initialState: activity.state,
          skillRules: options.skillRules,
          useSkill: (battleState, actorId, targetId, skillId) => {
            const result = options.dispatch({
              type: "skill",
              actorId,
              targetId,
              skillId,
              expectedActionTime: battleState.logicalTime,
              expectedNodeId: state.activeNodeId ?? "",
              expeditionActionId: state.expeditionActionId ?? -1,
            });
            if (!result.accepted) return { accepted: false, reason: result.reason };
            dungeonState = result.state;
            if (result.battleState === undefined) return { accepted: false, reason: "戦闘結果を取得できませんでした" };
            return { accepted: true, state: result.battleState, events: result.events };
          },
          combatants: labelDefinitions,
          displayNames: { ...combatantNames, ...options.displayNames },
          finishButtonLabel: "ルートへ戻る",
          finishButtonAriaLabel: "戦闘を終えてルートへ戻る",
          attack: (_battleState, actorId, targetId) => {
            const result = options.dispatch({ type: "attack", actorId, targetId });
            if (!result.accepted) return { accepted: false, reason: result.reason };
            dungeonState = result.state;
            if (result.battleState === undefined) {
              return { accepted: false, reason: "戦闘結果を取得できませんでした" };
            }
            return { accepted: true, state: result.battleState, events: result.events };
          },
          onFinish: () => {
            disposeBattle();
            if (renderGrowth()) return;
            if (dungeonState.outcome === "failed") {
              options.onReturn();
              return;
            }
            if (dungeonState.outcome === "ongoing") renderRoute();
            else renderOutcome();
          },
        });
      })
      .catch((error: unknown) => {
        if (disposed || currentLoadId !== battleLoadId || battleScene !== currentScene) return;
        console.error(error);
        battleStatus.textContent =
          "戦闘画面を読み込めませんでした。素材とWebGL対応を確認して、再読み込みしてください。";
        battleStatus.dataset.error = "true";
      });
  }

  function applyDungeonResult(result: DungeonActionResult): void {
    if (!result.accepted) {
      status.textContent = `操作できませんでした: ${result.reason}`;
      return;
    }
    dungeonState = result.state;
    if (renderGrowth()) return;
    if (dungeonState.outcome === "failed") {
      options.onReturn();
      return;
    }
    if (dungeonState.outcome !== "ongoing") {
      renderOutcome();
    } else if (dungeonState.activity?.type === "battle") {
      startBattle(dungeonState);
    } else if (dungeonState.activity?.type === "conversation") {
      renderConversation();
    } else {
      renderRoute();
    }
  }

  conversationStage.addEventListener(
    "click",
    (event) => {
      if ((event.target as Element).closest("button") !== null) return;
      const scene = getCurrentDungeonConversationScene(dungeonState, initialAdventure);
      if (scene?.type === "line") applyDungeonResult(options.dispatch({ type: "advance" }));
    },
    { signal: events.signal },
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, select, textarea, [contenteditable='true']")
      ) {
        return;
      }
      const scene = getCurrentDungeonConversationScene(dungeonState, initialAdventure);
      if (!scene || event.repeat) return;
      if (scene.type === "choice" && /^(Digit|Numpad)[1-9]$/.test(event.code)) {
        const option = scene.options[Number(event.code.at(-1)) - 1];
        if (option === undefined) return;
        event.preventDefault();
        applyDungeonResult(options.dispatch({ type: "choose", optionId: option.id }));
      } else if (scene.type === "line" && event.code === "Space") {
        event.preventDefault();
        applyDungeonResult(options.dispatch({ type: "advance" }));
      }
    },
    { signal: events.signal },
  );

  routeViewport.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      activePointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartOffset = routeOffset;
      dragMoved = false;
    },
    { signal: events.signal },
  );
  routeViewport.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerId !== activePointerId) return;
      const delta = event.clientX - dragStartX;
      if (Math.abs(delta) > 3 && !dragMoved) {
        dragMoved = true;
        hasUserPannedRoute = true;
        routeViewport.classList.add("is-dragging");
        routeViewport.setPointerCapture(event.pointerId);
      }
      if (dragMoved) setRouteOffset(dragStartOffset + delta);
    },
    { signal: events.signal },
  );
  const stopDragging = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = undefined;
    routeViewport.classList.remove("is-dragging");
    if (dragMoved) {
      suppressNextNodeClick = true;
      window.setTimeout(() => {
        suppressNextNodeClick = false;
      }, 0);
    }
  };
  routeViewport.addEventListener("pointerup", stopDragging, { signal: events.signal });
  routeViewport.addEventListener("pointercancel", stopDragging, { signal: events.signal });
  routeViewport.addEventListener(
    "keydown",
    (event) => {
      if (event.target !== routeViewport) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        hasUserPannedRoute = true;
        setRouteOffset(routeOffset + (event.key === "ArrowRight" ? -48 : 48));
      }
    },
    { signal: events.signal },
  );

  const resizeObserver = new ResizeObserver(() => {
    if (hasUserPannedRoute) setRouteOffset(routeOffset);
    else centerRouteForCurrentProgress();
    scheduleEdgeRefresh();
  });
  resizeObserver.observe(routeViewport);

  routeViewport.addEventListener("scroll", scheduleEdgeRefresh, { signal: events.signal });
  window.addEventListener("scroll", scheduleEdgeRefresh, { capture: true, signal: events.signal });

  if (!renderGrowth()) renderRoute();
  return () => {
    disposeGrowth?.();
    disposeBranchSkills?.();
    disposed = true;
    disposeBattle();
    battleRenderer?.dispose();
    battleRenderer = undefined;
    resizeObserver.disconnect();
    if (edgeRefreshFrame !== undefined) cancelAnimationFrame(edgeRefreshFrame);
    events.abort();
    status.textContent = "";
  };
}
