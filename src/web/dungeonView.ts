import type { BranchFocus } from "../presentation/branchRecoveryModel";
import type { DungeonEffect, DungeonEvent, DungeonFocus } from "../presentation/dungeonModel";
import type { DungeonFrame } from "../presentation/dungeonProjection";
import { projectRouteEdge, type RouteImageMeasure } from "../presentation/dungeonRoute";
import savedAdventureSettings from "./adventure-settings.json";
import { applyAdventureSettings, parseAdventureSettings } from "./adventureSettings";
import savedBattleSettings from "./battle-settings.json";
import { type BattleScene, createBattleRenderer, initialBattleEnvironment } from "./battleScene";
import { parseBattleSettings } from "./battleSettings";
import { createBattleView } from "./battleView";
import { createGrowthChoiceView } from "./growthChoiceView";
import { requiredElement } from "./requiredElement";

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
const focusKey = (target: DungeonFocus | BranchFocus) => JSON.stringify(target);
function choiceMarker() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("choice-tetrahedron");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<polygon points="30,16 4,3 4,29" fill="#394438" stroke="#f0b84a" stroke-width="1.5" /><path d="M30 16H4M4 3l12 13L4 29" fill="none" stroke="#f0b84a" stroke-width="1.2" />';
  return svg;
}

/** Native handles, measurements and paint records. The parent commits every meaning event first. */
export function createDungeonView(root: HTMLDivElement, send: (event: DungeonEvent) => boolean, returnLabel: string) {
  root.innerHTML = `
    <main class="dungeon-app" data-dungeon-app>
      <section class="dungeon-route-screen" data-route-screen aria-label="遺跡の進路">
        <div class="dungeon-route-background" data-route-background aria-hidden="true">
          <img src="${assetUrl("backgrounds/dungeon-route.png")}" alt="" />
        </div>
        <button type="button" class="dungeon-town-link" data-return-town data-single-activation>${returnLabel}</button>
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
        <button type="button" class="dungeon-outcome-return" data-return-town data-single-activation>${returnLabel}</button>
      </section>
      <section data-growth-screen hidden></section>
      <p class="sr-only" data-dungeon-status role="status" aria-live="polite"></p>
    </main>
  `;
  const events = new AbortController(),
    signal = events.signal;
  const element = <T extends HTMLElement = HTMLElement>(selector: string) => requiredElement<T>(root, selector);
  const routeScreen = element("[data-route-screen]"),
    routeViewport = element<HTMLDivElement>("[data-route-viewport]");
  const world = element<HTMLDivElement>("[data-route-world]"),
    background = element("[data-route-background]");
  const routeNodes = element("[data-route-nodes]"),
    edges = requiredElement<SVGSVGElement>(root, "[data-route-edges]");
  const conversation = element("[data-conversation-screen]"),
    stage = element("[data-conversation-stage]");
  const portraits = element("[data-conversation-portraits]"),
    choices = element("[data-conversation-choices]");
  const battleScreen = element("[data-battle-screen]"),
    board = element<HTMLDivElement>("[data-board]");
  const canvas = element<HTMLCanvasElement>("canvas"),
    battleStatus = element("[data-status]");
  const outcome = element("[data-outcome-screen]"),
    growthScreen = element("[data-growth-screen]");
  applyAdventureSettings(conversation, parseAdventureSettings(savedAdventureSettings));
  outcome.style.backgroundImage = `linear-gradient(180deg, #171d19d9, #171d19ee), url("${assetUrl("backgrounds/dungeon-route.png")}")`;
  const routeReturn = routeScreen.querySelector<HTMLButtonElement>("[data-return-town]") as HTMLButtonElement;
  const outcomeReturn = outcome.querySelector<HTMLButtonElement>("[data-return-town]") as HTMLButtonElement;
  const focusNodes = new Map<string, HTMLElement>(),
    branchNodes = new Map<string, HTMLElement>();
  const nodeButtons = new Map<string, HTMLButtonElement>();
  function register(node: HTMLElement, target: DungeonFocus) {
    focusNodes.set(focusKey(target), node);
    node.addEventListener("focus", () => send({ type: "focused", target }), { signal });
  }
  register(routeViewport, { kind: "route" });
  for (const button of [routeReturn, outcomeReturn]) {
    button.addEventListener("click", () => send({ type: "return" }), { signal });
    button.addEventListener("focus", () => send({ type: "focused", target: { kind: "return" } }), { signal });
  }
  choices.addEventListener("click", (event) => event.stopPropagation(), { signal });
  stage.addEventListener("click", () => send({ type: "advance" }), { signal });
  window.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "key", key: event.key, code: event.code, shift: event.shiftKey })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal },
  );
  const context = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || target.matches("input,select,textarea"))
      ? ("text-entry" as const)
      : target instanceof HTMLElement && target.matches("button,a[href]")
        ? ("control" as const)
        : ("screen" as const);
  window.addEventListener("focusin", (event) => send({ type: "input-context", context: context(event.target) }), {
    signal,
  });
  window.addEventListener(
    "focusout",
    (event) => send({ type: "input-context", context: context(event.relatedTarget) }),
    { signal },
  );
  routeViewport.addEventListener(
    "pointerdown",
    (event) =>
      send({
        type: "route",
        event: { type: "pointer-down", pointerId: event.pointerId, x: event.clientX, button: event.button },
      }),
    { signal },
  );
  routeViewport.addEventListener(
    "pointermove",
    (event) => send({ type: "route", event: { type: "pointer-move", pointerId: event.pointerId, x: event.clientX } }),
    { signal },
  );
  for (const type of ["pointerup", "pointercancel"] as const)
    routeViewport.addEventListener(
      type,
      (event) => send({ type: "route", event: { type: "pointer-end", pointerId: event.pointerId } }),
      { signal },
    );
  routeViewport.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "route", event: { type: "pan-key", key: event.key } })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal },
  );
  const skillTrigger = document.createElement("button");
  skillTrigger.type = "button";
  skillTrigger.className = "branch-skill-trigger";
  skillTrigger.textContent = "分岐で回復";
  const skillDialog = document.createElement("dialog");
  skillDialog.className = "branch-skill-dialog";
  skillDialog.setAttribute("aria-label", "分岐の回復スキル");
  const itemTrigger = document.createElement("button");
  itemTrigger.type = "button";
  itemTrigger.className = "command item-trigger";
  const itemDialog = document.createElement("dialog");
  itemDialog.className = "item-dialog";
  itemDialog.setAttribute("aria-label", "HP回復品の使用");
  itemDialog.innerHTML =
    '<h2>HP回復品</h2><p>生存中の味方1人のHPを回復します。精神疲労は増えません。</p><label>対象<select data-item-target></select></label><p data-item-preview role="status"></p><div class="item-actions"><button type="button" class="command" data-item-use>使用する</button><button type="button" class="command" data-item-cancel>戻る</button></div>';
  const target = requiredElement<HTMLSelectElement>(itemDialog, "select"),
    itemUse = requiredElement<HTMLButtonElement>(itemDialog, "[data-item-use]"),
    itemBack = requiredElement<HTMLButtonElement>(itemDialog, "[data-item-cancel]");
  const branchResult = document.createElement("p");
  branchResult.className = "branch-skill-result";
  branchResult.setAttribute("role", "status");
  routeScreen.append(skillTrigger, skillDialog, itemTrigger, itemDialog, branchResult);
  function registerBranch(node: HTMLElement, target: BranchFocus) {
    branchNodes.set(focusKey(target), node);
    node.addEventListener("focus", () => send({ type: "branch", event: { type: "focused", target } }), { signal });
  }
  registerBranch(skillTrigger, { kind: "skill-trigger" });
  registerBranch(itemTrigger, { kind: "item-trigger" });
  registerBranch(target, { kind: "item-target" });
  registerBranch(itemUse, { kind: "item-use" });
  registerBranch(itemBack, { kind: "cancel" });
  skillTrigger.addEventListener("click", () => send({ type: "branch", event: { type: "open-skill" } }), { signal });
  itemTrigger.addEventListener("click", () => send({ type: "branch", event: { type: "open-item" } }), { signal });
  target.addEventListener("change", () => send({ type: "branch", event: { type: "item-target", id: target.value } }), {
    signal,
  });
  itemUse.addEventListener("click", () => send({ type: "branch", event: { type: "use-item" } }), { signal });
  itemBack.addEventListener("click", () => send({ type: "branch", event: { type: "cancel" } }), { signal });
  for (const dialog of [skillDialog, itemDialog]) {
    dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        send({ type: "branch", event: { type: "cancel" } });
      },
      { signal },
    );
    dialog.addEventListener(
      "keydown",
      (event) => {
        if (send({ type: "branch", event: { type: "key", key: event.key, shift: event.shiftKey } }))
          event.preventDefault();
        event.stopPropagation();
      },
      { signal },
    );
  }
  const growth = createGrowthChoiceView(growthScreen, (event) => send({ type: "growth", event }));
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", () => send({ type: "motion", reduced: motion.matches }), { signal });
  let frame: DungeonFrame | undefined, renderer: ReturnType<typeof createBattleRenderer> | undefined;
  let scene: BattleScene | undefined, battleView: ReturnType<typeof createBattleView> | undefined;
  let animation: number | undefined, previousTime: number | undefined;
  let nodesPaint = "",
    choicesPaint = "",
    portraitsPaint = "",
    skillPaint = "",
    targetsPaint = "";
  let appliedFocus: string | undefined, appliedBranchFocus: string | undefined;
  let skillCancel: HTMLButtonElement | undefined;
  const branchElement = (target: BranchFocus, current: DungeonFrame) =>
    target.kind === "cancel"
      ? current.branch.panel === "item"
        ? itemBack
        : skillCancel
      : branchNodes.get(focusKey(target));
  let measured = "",
    responsiveWidth = 0;
  function stopClock() {
    if (animation !== undefined) cancelAnimationFrame(animation);
    animation = undefined;
    previousTime = undefined;
  }
  function clock(animate: boolean) {
    if (!animate) {
      stopClock();
      return;
    }
    if (animation === undefined)
      animation = requestAnimationFrame((time) => {
        animation = undefined;
        const elapsedMs = previousTime === undefined ? 0 : time - previousTime;
        previousTime = time;
        send({ type: "battle", event: { type: "playback", event: { type: "advance", elapsedMs } } });
      });
  }
  function imageMeasure(button: HTMLButtonElement): RouteImageMeasure {
    const image = requiredElement<HTMLImageElement>(button, "img");
    return {
      centerX: button.offsetLeft,
      centerY: button.offsetTop,
      buttonWidth: button.offsetWidth,
      buttonHeight: button.offsetHeight,
      imageLeft: image.offsetLeft,
      imageTop: image.offsetTop,
      imageWidth: image.offsetWidth,
      imageHeight: image.offsetHeight,
    };
  }
  function paintEdges(current: DungeonFrame) {
    const bounds = world.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    edges.replaceChildren(
      ...current.route.edges.flatMap((edge) => {
        const source = nodeButtons.get(edge.from),
          target = nodeButtons.get(edge.to);
        if (!source || !target) return [];
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("dungeon-route-edge", `is-${edge.appearance}`);
        path.dataset.edgeFrom = edge.from;
        path.dataset.edgeTo = edge.to;
        path.setAttribute("d", projectRouteEdge(imageMeasure(source), imageMeasure(target), bounds));
        return [path];
      }),
    );
  }
  function measureRoute(responsive = false) {
    const current = frame;
    if (current?.kind !== "route") return;
    if (responsive) {
      const requestedWidth = world.style.width;
      world.style.width = "";
      responsiveWidth = world.clientWidth;
      world.style.width = requestedWidth;
    }
    const measure = {
      viewportWidth: routeViewport.clientWidth,
      responsiveWorldWidth: responsiveWidth,
      nodes: current.route.nodes.map((node) => {
        const button = nodeButtons.get(node.id) as HTMLButtonElement;
        return { id: node.id, fraction: node.position.x / 100, center: button.offsetLeft, width: button.offsetWidth };
      }),
    };
    const key = JSON.stringify(measure);
    if (measured !== key) {
      measured = key;
      send({ type: "route", event: { type: "measured", measure } });
    }
    if (frame) paintEdges(frame);
  }
  const resize = new ResizeObserver(() => measureRoute(true));
  resize.observe(routeViewport);
  function closeScene() {
    stopClock();
    battleView?.dispose();
    battleView = undefined;
    scene?.dispose();
    scene = undefined;
  }
  return {
    getEnemyDepths: () => scene?.getCombatantDepths() ?? [],
    reducedMotion: () => motion.matches,
    effect(effect: DungeonEffect, picture: DungeonFrame["battle"]) {
      if (effect.type === "capture-pointer") {
        routeViewport.setPointerCapture(effect.pointerId);
        return;
      }
      closeScene();
      if (effect.type === "close-scene") {
        if (effect.releaseRenderer) {
          renderer?.dispose();
          renderer = undefined;
        }
        return;
      }
      if (!picture) throw new Error("A committed battle picture owns each new scene");
      const failed = (error: unknown) =>
        send({
          type: "battle",
          event: {
            type: "scene-error",
            owner: effect.owner,
            reason: error instanceof Error ? error.message : String(error),
          },
        });
      try {
        renderer ??= createBattleRenderer(canvas, parseBattleSettings(savedBattleSettings));
        scene = renderer.beginBattle(picture.definitions, initialBattleEnvironment, picture.actors);
        void scene.ready.then(
          () => send({ type: "battle", event: { type: "scene-ready", owner: effect.owner } }),
          failed,
        );
      } catch (error) {
        failed(error);
      }
    },
    render(next: DungeonFrame) {
      const previous = frame;
      frame = next;
      document.body.classList.add("dungeon-mode");
      routeScreen.hidden = next.kind !== "route";
      conversation.hidden = next.kind !== "conversation";
      battleScreen.hidden = next.kind !== "battle";
      outcome.hidden = next.kind !== "outcome";
      growthScreen.hidden = next.kind !== "growth";
      element("[data-calendar]").textContent = next.calendar;
      element("[data-dungeon-status]").textContent = next.status;
      routeReturn.textContent = next.returnLabel;
      outcomeReturn.textContent = next.returnLabel;
      branchResult.textContent = next.branchResult;
      element("[data-outcome-title]").textContent = next.outcome.title;
      element("[data-outcome-detail]").textContent = next.outcome.detail;
      const nextNodes = JSON.stringify(next.route.nodes),
        nodesChanged = nodesPaint !== nextNodes;
      if (nodesChanged) {
        nodesPaint = nextNodes;
        nodeButtons.clear();
        appliedFocus = undefined;
        routeNodes.replaceChildren(
          ...next.route.nodes.map((node) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `dungeon-route-node type-${node.type}${node.current ? " is-current" : ""}${node.enabled ? " is-available" : ""}${node.past ? " is-past-unselected" : ""}${node.resolved ? " is-resolved" : ""}`;
            button.disabled = !node.enabled;
            button.style.left = `${node.position.x}%`;
            button.style.top = `${node.position.y}%`;
            button.dataset.nodeId = node.id;
            button.dataset.nodeType = node.type;
            button.dataset.nodeState = node.status;
            button.setAttribute("aria-label", node.label);
            if (node.current) button.setAttribute("aria-current", "location");
            const image = document.createElement("img");
            image.src = assetUrl(node.icon);
            image.alt = "";
            image.draggable = false;
            image.decoding = "sync";
            image.setAttribute("aria-hidden", "true");
            button.append(image);
            image.addEventListener("load", () => measureRoute(true), { signal });
            if (node.title !== null) {
              const label = document.createElement("span");
              label.className = "dungeon-route-node-label";
              label.textContent = node.title;
              button.append(label);
            }
            button.addEventListener("click", () => send({ type: "enter", nodeId: node.id }), { signal });
            register(button, { kind: "node", id: node.id });
            nodeButtons.set(node.id, button);
            return button;
          }),
        );
      }
      const priorWidth = world.style.width;
      world.style.width = next.route.width === null ? "" : `${next.route.width}px`;
      world.style.transform = `translate3d(${next.route.offset}px, 0, 0)`;
      background.style.transform = `translate3d(${next.route.offset * 0.42}px, 0, 0)`;
      routeViewport.dataset.routeOffset = String(Math.round(next.route.offset));
      routeViewport.classList.toggle("is-dragging", next.route.dragging);
      skillTrigger.hidden = !next.branch.skillVisible;
      itemTrigger.hidden = !next.branch.itemVisible;
      itemTrigger.disabled = !next.branch.itemAvailable;
      itemTrigger.textContent = next.branch.itemLabel;
      const nextSkill = JSON.stringify([next.branch.title, next.branch.buttons, next.branch.empty]);
      if (nextSkill !== skillPaint) {
        skillPaint = nextSkill;
        appliedBranchFocus = undefined;
        const heading = document.createElement("h2");
        heading.textContent = next.branch.title;
        skillDialog.replaceChildren(heading);
        for (const data of next.branch.buttons) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = data.label;
          registerBranch(button, data.focus);
          button.addEventListener("click", () => send({ type: "branch", event: data.event }), { signal });
          skillDialog.append(button);
          if (data.description) {
            const p = document.createElement("p");
            p.textContent = data.description;
            skillDialog.append(p);
          }
        }
        if (!next.branch.buttons.length) {
          const p = document.createElement("p");
          p.textContent = next.branch.empty;
          skillDialog.append(p);
        }
        const cancel = document.createElement("button");
        skillCancel = cancel;
        cancel.type = "button";
        cancel.textContent = "取消";
        registerBranch(cancel, { kind: "cancel" });
        cancel.addEventListener("click", () => send({ type: "branch", event: { type: "cancel" } }), { signal });
        skillDialog.append(cancel);
      }
      const targetPaint = JSON.stringify(next.branch.targets);
      if (targetsPaint !== targetPaint) {
        targetsPaint = targetPaint;
        target.replaceChildren(
          ...next.branch.targets.map((data) => {
            const option = document.createElement("option");
            option.value = data.id;
            option.textContent = data.label;
            return option;
          }),
        );
      }
      target.value = next.branch.itemTargetId ?? "";
      itemUse.disabled = !next.branch.itemUsable;
      requiredElement<HTMLElement>(itemDialog, "[data-item-preview]").textContent = next.branch.itemPreview;
      if (next.branch.panel !== "skill" && skillDialog.open) skillDialog.close();
      if (next.branch.panel !== "item" && itemDialog.open) itemDialog.close();
      if (next.branch.panel === "skill" && !skillDialog.open) skillDialog.showModal();
      if (next.branch.panel === "item" && !itemDialog.open) itemDialog.showModal();
      const conversationFrame = next.conversation;
      element("[data-conversation-background]").dataset.backgroundId = conversationFrame?.backgroundId ?? "roadside";
      element("[data-speaker]").textContent = conversationFrame?.scene?.speaker ?? "";
      element("[data-dialogue-text]").textContent = conversationFrame?.scene?.text ?? "";
      element("[data-dialogue-next]").hidden = conversationFrame?.scene?.type !== "line";
      stage.dataset.sceneType = conversationFrame?.scene?.type ?? "line";
      const nextPortraits = JSON.stringify(conversationFrame?.scene?.portraits ?? []);
      if (portraitsPaint !== nextPortraits) {
        portraitsPaint = nextPortraits;
        portraits.replaceChildren(
          ...(conversationFrame?.scene?.portraits ?? []).map((data) => {
            const portrait = document.createElement("figure");
            portrait.className = `conversation-portrait${data.speaking ? " is-speaking" : " is-muted"}`;
            portrait.dataset.portraitId = data.id;
            portrait.dataset.position = data.position;
            if (data.path) {
              const image = document.createElement("img");
              image.src = assetUrl(data.path);
              image.alt = "";
              image.decoding = "async";
              portrait.append(image);
            }
            return portrait;
          }),
        );
      }
      const nextChoices = JSON.stringify(conversationFrame?.scene?.choices ?? []);
      if (choicesPaint !== nextChoices) {
        choicesPaint = nextChoices;
        appliedFocus = undefined;
        choices.replaceChildren(
          ...(conversationFrame?.scene?.choices ?? []).map((data) => {
            const button = document.createElement("button");
            button.className = "conversation-choice";
            button.type = "button";
            button.dataset.optionId = data.id;
            const number = document.createElement("span");
            number.className = "choice-number";
            number.textContent = String(data.number);
            const label = document.createElement("span");
            label.className = "choice-label";
            label.textContent = data.label;
            button.append(choiceMarker(), number, label);
            button.addEventListener(
              "click",
              (event) => {
                event.stopPropagation();
                send({ type: "choose", optionId: data.id });
              },
              { signal },
            );
            register(button, { kind: "choice", id: data.id });
            return button;
          }),
        );
      }
      choices.hidden = !conversationFrame?.scene?.choices.length;
      if (next.growth) growth.render(next.growth, next.growthFocus);
      if (next.battle) {
        battleStatus.textContent = next.battle.status.text;
        battleStatus.classList.toggle("sr-only", next.battle.status.ready);
        battleStatus.toggleAttribute("data-error", next.battle.status.error);
        canvas.toggleAttribute("data-ready", next.battle.status.ready);
        if (next.battle.status.ready) canvas.dataset.ready = "true";
        if (next.battle.view && scene) {
          scene.paintBattleFrame(next.battle.actors);
          battleView ??= createBattleView(board, scene, (event) => send({ type: "battle", event }));
          const measure = battleView.paint(next.battle.view);
          if (measure) send({ type: "battle", event: { type: "party-measured", measure } });
        }
      }
      const latest = frame;
      if (latest) {
        const focus = JSON.stringify(latest.focus);
        if (appliedFocus !== focus) {
          appliedFocus = focus;
          const target = latest.focus;
          if (target)
            (target.kind === "return"
              ? latest.kind === "outcome"
                ? outcomeReturn
                : routeReturn
              : target.kind === "branch"
                ? branchElement(target.target, latest)
                : focusNodes.get(focusKey(target))
            )?.focus();
        }
        const branchFocus = JSON.stringify({ panel: latest.branch.panel, focus: latest.branch.focus });
        if (appliedBranchFocus !== branchFocus) {
          appliedBranchFocus = branchFocus;
          if (latest.branch.focus) branchElement(latest.branch.focus, latest)?.focus();
        }
        clock(latest.battle?.animate ?? false);
      }
      if (next.kind === "route") {
        if (nodesChanged || previous?.kind !== "route") measureRoute(true);
        else if (priorWidth !== world.style.width) measureRoute();
        paintEdges(frame ?? next);
      }
    },
    dispose() {
      events.abort();
      resize.disconnect();
      growth.dispose();
      closeScene();
      renderer?.dispose();
      renderer = undefined;
      skillDialog.close();
      itemDialog.close();
      document.body.classList.remove("dungeon-mode");
    },
  };
}
