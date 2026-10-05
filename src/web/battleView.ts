import type { BattleFocus, BattleModelEvent } from "../presentation/battleModel";
import {
  type PartyMeasurement,
  projectEnemyOverlay,
  projectMobileLabelSeparation,
  projectPartyOverflow,
  projectTargetMarker,
} from "../presentation/battlePlacement";
import type { BattleViewFrame } from "../presentation/battleViewProjection";
import type { BattleScene } from "./battleScene";
import { createBattleSequenceView } from "./battleSequenceView";
import { requiredElement } from "./requiredElement";
import "./items.css";

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
        <div class="sequence-controls"><label>演出 <select data-sequence-speed aria-label="演出速度"><option value="1">1倍</option><option value="2">2倍</option><option value="0">即時</option></select></label><button type="button" data-sequence-skip hidden>演出を省略</button></div>
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

type SceneProjection = Pick<BattleScene, "getCombatantScreenRect" | "refreshCombatantScreenPositions">;
const focusKey = (focus: BattleFocus) =>
  `${focus.kind}${"id" in focus ? `:${focus.id}` : ""}${"symptom" in focus ? `:${focus.symptom}` : ""}`;

/** Native nodes and measurements only. Every accepted operation is decided by the parent model. */
export function createBattleView(
  board: HTMLDivElement,
  scene: SceneProjection,
  dispatch: (event: BattleModelEvent) => boolean,
) {
  const events = new AbortController();
  const signal = events.signal;
  const stage = requiredElement<HTMLElement>(board, ".stage");
  const hud = document.createElement("div");
  hud.innerHTML = makeBattleMarkup();
  board.append(hud);
  const ui = requiredElement<HTMLElement>(hud, "[data-battle-ui]");
  const queue = requiredElement<HTMLElement>(hud, "[data-timeline]");
  const party = requiredElement<HTMLElement>(hud, "[data-party]");
  const marker = requiredElement<HTMLElement>(hud, "[data-target-indicator]");
  const mesh = requiredElement<SVGGElement>(hud, "[data-tetra-mesh]");
  const toast = requiredElement<HTMLElement>(hud, "[data-event-toast]");
  const announcement = requiredElement<HTMLElement>(hud, "[data-screen-reader-status]");
  announcement.id = "battle-screen-reader-status";
  stage.append(marker, toast);
  const sequence = createBattleSequenceView(stage, scene);
  const focusTargets = new Map<string, HTMLElement>();
  const enemyNodes = new Map<string, { button: HTMLButtonElement; label: HTMLElement }>();
  const element = <T extends HTMLElement = HTMLElement>(selector: string) => requiredElement<T>(hud, selector);
  function register(node: HTMLElement, target: BattleFocus) {
    focusTargets.set(focusKey(target), node);
    node.addEventListener("focus", () => dispatch({ type: "focused", target }), { signal });
  }
  for (const [selector, kind, type] of [
    ["[data-attack]", "attack", "attack"],
    ["[data-skills]", "skills", "open-skills"],
    ["[data-use-skill]", "use-skill", "use-skill"],
    ["[data-cancel-skill]", "cancel-skill", "cancel-skills"],
    ["[data-rematch]", "finish", "finish"],
  ] as const) {
    const control = element<HTMLButtonElement>(selector);
    register(control, { kind });
    control.addEventListener("click", () => dispatch({ type }), { signal });
  }
  const speed = element<HTMLSelectElement>("[data-sequence-speed]");
  register(speed, { kind: "speed" });
  speed.addEventListener(
    "change",
    () => dispatch({ type: "playback", event: { type: "speed", speed: Number(speed.value) as 0 | 1 | 2 } }),
    { signal },
  );
  const skip = element<HTMLButtonElement>("[data-sequence-skip]");
  register(skip, { kind: "skip" });
  skip.addEventListener("click", () => dispatch({ type: "playback", event: { type: "skip" } }), { signal });
  const allyTarget = element<HTMLSelectElement>("[data-ally-target]");
  register(allyTarget, { kind: "ally-target" });
  allyTarget.addEventListener("change", () => dispatch({ type: "select-ally", id: allyTarget.value }), { signal });

  const itemTrigger = document.createElement("button");
  itemTrigger.type = "button";
  itemTrigger.className = "command item-trigger";
  const dialog = document.createElement("dialog");
  dialog.className = "item-dialog";
  dialog.setAttribute("aria-label", "HP回復品の使用");
  dialog.innerHTML =
    '<h2>HP回復品</h2><p>生存中の味方1人のHPを回復します。精神疲労は増えません。</p><label>対象<select data-item-target></select></label><p data-item-preview role="status"></p><div class="item-actions"><button type="button" class="command" data-item-use>使用する</button><button type="button" class="command" data-item-cancel>戻る</button></div>';
  element(".commands").append(itemTrigger, dialog);
  register(itemTrigger, { kind: "item" });
  itemTrigger.addEventListener("click", () => dispatch({ type: "open-item" }), { signal });
  const itemTarget = requiredElement<HTMLSelectElement>(dialog, "[data-item-target]");
  const itemUse = requiredElement<HTMLButtonElement>(dialog, "[data-item-use]");
  const itemBack = requiredElement<HTMLButtonElement>(dialog, "[data-item-cancel]");
  register(itemTarget, { kind: "item-target" });
  register(itemUse, { kind: "item-use" });
  register(itemBack, { kind: "item-back" });
  itemTarget.addEventListener("change", () => dispatch({ type: "select-item-target", id: itemTarget.value }), {
    signal,
  });
  itemUse.addEventListener("click", () => dispatch({ type: "use-item" }), { signal });
  itemBack.addEventListener("click", () => dispatch({ type: "cancel-item" }), { signal });
  dialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      dispatch({ type: "cancel-item" });
    },
    { signal },
  );
  board.addEventListener(
    "keydown",
    (event) => {
      if (dispatch({ type: "key", key: event.key, shift: event.shiftKey })) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { signal },
  );

  let painted: BattleViewFrame | undefined;
  let appliedFocus: BattleFocus | null | undefined;
  let queuePaint = "",
    allyPaint = "",
    skillPaint = "",
    itemPaint = "";
  let hudPaint = "",
    markerPaint = "";
  let appliedPartyAnchor: BattleViewFrame["partyAnchor"] | undefined;
  function hpBar(fraction: number) {
    const bar = document.createElement("span");
    bar.className = "hp-track";
    bar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.width = `${fraction * 100}%`;
    bar.append(fill);
    return bar;
  }
  function paintParty(frame: BattleViewFrame) {
    const nodes = frame.allies.map((member) => {
      const card = document.createElement("article");
      card.className = `ally-card${member.active ? " active" : ""}${member.defeated ? " defeated" : ""}`;
      if (member.active) card.setAttribute("aria-current", "true");
      card.setAttribute("aria-label", member.label);
      const image = document.createElement("img");
      image.className = "ally-portrait";
      image.alt = "";
      image.src = `${import.meta.env.BASE_URL}assets/${member.portrait}`;
      const details = document.createElement("div");
      details.className = "ally-details";
      const heading = document.createElement("div");
      heading.className = "ally-heading";
      const title = document.createElement("strong");
      title.textContent = member.name;
      const status = document.createElement("span");
      status.className = "ally-status";
      status.textContent = member.status;
      heading.append(title, status);
      const hp = document.createElement("div");
      hp.className = "hp-line";
      const label = document.createElement("span");
      label.textContent = "HP";
      const amount = document.createElement("b");
      amount.textContent = member.hp;
      const maximum = document.createElement("span");
      maximum.textContent = `/ ${member.maximum}`;
      hp.append(label, amount, maximum);
      const symptoms = document.createElement("div");
      symptoms.className = "symptom-icons";
      symptoms.hidden = member.symptoms.length === 0;
      for (const symptom of member.symptoms) {
        const disclosure = document.createElement("details");
        disclosure.className = "symptom-icon";
        disclosure.open = symptom.open;
        const summary = document.createElement("summary");
        const icon = document.createElement("span");
        icon.className = "symptom-mark";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = symptom.icon;
        const name = document.createElement("span");
        name.textContent = symptom.label;
        summary.append(icon, name);
        const description = document.createElement("span");
        description.className = "symptom-description";
        description.textContent = symptom.detail;
        disclosure.append(summary, description);
        symptoms.append(disclosure);
        register(summary, { kind: "symptom", id: member.id, symptom: symptom.kind });
        summary.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            dispatch({ type: "toggle-symptom", id: member.id, symptom: symptom.kind });
          },
          { signal },
        );
      }
      details.append(heading, hp, hpBar(member.fraction), symptoms);
      card.append(image, details);
      return card;
    });
    party.replaceChildren(...nodes);
    appliedFocus = undefined;
  }
  function paintQueue(frame: BattleViewFrame) {
    queue.replaceChildren(
      ...frame.queue.map((member) => {
        const row = document.createElement("li");
        row.className = `queue-row${member.current ? " current" : ""}${member.enemy ? " enemy" : ""}`;
        if (member.current) row.setAttribute("aria-current", "step");
        row.setAttribute("aria-label", member.label);
        const icon = document.createElement("span");
        icon.className = "queue-portrait";
        const image = document.createElement("img");
        image.alt = "";
        image.src = `${import.meta.env.BASE_URL}assets/${member.portrait}`;
        icon.append(image);
        const name = document.createElement("span");
        name.className = "queue-name";
        name.textContent = member.name;
        row.append(icon, name);
        if (!member.current) {
          const value = document.createElement("span");
          value.className = "queue-value";
          const number = document.createElement("b");
          number.textContent = String(member.ticks);
          value.append(number);
          row.append(value);
        }
        return row;
      }),
    );
  }
  function paintEnemies(frame: BattleViewFrame) {
    for (const member of frame.enemies) {
      let nodes = enemyNodes.get(member.id);
      if (!nodes) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "enemy-hitbox";
        button.dataset.combatantId = member.id;
        button.setAttribute("aria-describedby", announcement.id);
        register(button, { kind: "enemy", id: member.id });
        button.addEventListener("click", () => dispatch({ type: "select-enemy", id: member.id }), { signal });
        const label = document.createElement("div");
        label.className = "enemy-world-label";
        label.dataset.enemyLabel = member.id;
        label.setAttribute("role", "group");
        label.innerHTML =
          '<div class="enemy-world-heading"><strong data-enemy-name></strong><span class="enemy-world-hp" data-enemy-hp></span></div><span class="enemy-world-state" data-enemy-state></span>';
        const track = hpBar(member.fraction);
        track.classList.add("enemy-world-track");
        label.append(track);
        stage.append(label, button);
        nodes = { button, label };
        enemyNodes.set(member.id, nodes);
      }
      nodes.button.disabled = member.disabled;
      nodes.button.setAttribute("aria-pressed", String(member.pressed));
      nodes.button.setAttribute("aria-label", `${member.label}、攻撃対象に選択`);
      nodes.label.classList.toggle("defeated", member.defeated);
      nodes.label.classList.toggle("selected", member.selected);
      nodes.label.setAttribute("aria-label", member.label);
      requiredElement(nodes.label, "[data-enemy-name]").textContent = member.name;
      requiredElement(nodes.label, "[data-enemy-hp]").textContent = member.hp;
      requiredElement(nodes.label, "[data-enemy-state]").textContent = member.defeated ? "戦闘不能" : "";
      requiredElement<HTMLElement>(nodes.label, ".enemy-world-track > span").style.width = `${member.fraction * 100}%`;
    }
  }
  function place() {
    if (!painted) return;
    scene.refreshCombatantScreenPositions();
    for (const [index, member] of painted.enemies.entries()) {
      const nodes = enemyNodes.get(member.id);
      if (!nodes) continue;
      const position = projectEnemyOverlay(
        scene.getCombatantScreenRect(member.id),
        member.visible,
        index,
        stage.clientWidth,
      );
      nodes.button.hidden = position === null;
      nodes.label.hidden = position === null;
      nodes.label.dataset.spriteVisible = String(position !== null);
      if (!position) continue;
      for (const [property, value] of Object.entries({
        left: position.box.left,
        top: position.box.top,
        width: position.box.width,
        height: position.box.height,
      }))
        nodes.button.style.setProperty(property, `${value}px`);
      nodes.label.style.left = `${position.x}px`;
      nodes.label.style.top = `${position.y}px`;
      nodes.label.dataset.spriteTop = String(position.box.spriteTop);
    }
    const target = painted.markerId ? enemyNodes.get(painted.markerId)?.label : undefined;
    const position = projectTargetMarker(
      painted.markerId ? scene.getCombatantScreenRect(painted.markerId) : undefined,
      {
        visible: target !== undefined && !target.hidden,
        top: Number.parseFloat(target?.style.top ?? "0"),
        height: target?.offsetHeight ?? 0,
      },
      marker.offsetHeight,
    );
    marker.hidden = position === null;
    if (position) {
      marker.style.left = `${position.x}px`;
      marker.style.top = `${position.y}px`;
      const markerRect = marker.getBoundingClientRect();
      for (const [id, { label }] of enemyNodes)
        if (id !== painted.markerId && !label.hidden)
          label.style.top = `${projectMobileLabelSeparation(stage.clientWidth, markerRect, label.getBoundingClientRect(), Number.parseFloat(label.style.top), label.offsetHeight)}px`;
    }
  }
  function measureParty(): PartyMeasurement | undefined {
    if (!painted?.skillBattle) return;
    const cards = [...party.querySelectorAll<HTMLElement>(".ally-card")];
    party.style.removeProperty("height");
    party.style.removeProperty("align-items");
    for (const card of cards) card.style.removeProperty("min-height");
    const style = getComputedStyle(party);
    const rect = party.getBoundingClientRect();
    const measure = {
      absolute: style.position === "absolute",
      width: rect.width,
      height: rect.height,
      font: style.fontSize,
    };
    applyPartyAnchor();
    return measure;
  }
  function applyPartyAnchor() {
    if (!painted?.skillBattle) return;
    const cards = [...party.querySelectorAll<HTMLElement>(".ally-card")];
    party.style.removeProperty("height");
    party.style.removeProperty("align-items");
    for (const card of cards) card.style.removeProperty("min-height");
    if (painted.partyAnchor) {
      party.style.height = `${painted.partyAnchor.height}px`;
      party.style.alignItems = "flex-start";
      for (const card of cards) card.style.minHeight = `${painted.partyAnchor.height}px`;
    }
    ui.toggleAttribute(
      "data-party-overflow",
      projectPartyOverflow(
        painted.partyAnchor !== null,
        board.getBoundingClientRect().bottom,
        cards.map((card) => card.getBoundingClientRect().bottom),
      ),
    );
  }
  const observer = new ResizeObserver(() => {
    const measure = measureParty();
    if (measure) dispatch({ type: "party-measured", measure });
    place();
  });
  function observe() {
    observer.disconnect();
    observer.observe(stage);
    observer.observe(marker);
    for (const { label } of enemyNodes.values()) observer.observe(label);
    for (const details of party.querySelectorAll(".ally-details")) observer.observe(details);
  }
  function options(select: HTMLSelectElement, choices: readonly { readonly id: string; readonly text: string }[]) {
    select.replaceChildren(
      ...choices.map((choice) => {
        const node = document.createElement("option");
        node.value = choice.id;
        node.textContent = choice.text;
        return node;
      }),
    );
  }
  return {
    paint(frame: BattleViewFrame) {
      painted = frame;
      const nextHud = JSON.stringify({
        queue: frame.queue,
        allies: frame.allies,
        enemies: frame.enemies,
        attack: frame.attack,
        skills: frame.skills,
        items: frame.items,
        controls: frame.controls,
        result: frame.result,
        summary: frame.summary,
        announcement: frame.announcement,
        toast: frame.toast,
        skillBattle: frame.skillBattle,
        markerId: frame.markerId,
      });
      const hudChanged = hudPaint !== nextHud;
      if (markerPaint !== frame.markerMarkup) {
        markerPaint = frame.markerMarkup;
        mesh.innerHTML = frame.markerMarkup;
      }
      if (hudChanged) {
        hudPaint = nextHud;
        ui.toggleAttribute("data-skill-battle", frame.skillBattle);
        ui.classList.toggle("with-skills", frame.skillBattle);
        const nextQueue = JSON.stringify(frame.queue);
        if (queuePaint !== nextQueue) {
          queuePaint = nextQueue;
          paintQueue(frame);
        }
        const nextAllies = JSON.stringify(frame.allies);
        if (allyPaint !== nextAllies) {
          allyPaint = nextAllies;
          paintParty(frame);
        }
        paintEnemies(frame);
        element<HTMLButtonElement>("[data-attack]").hidden = !frame.attack.visible;
        element<HTMLButtonElement>("[data-attack]").disabled = !frame.attack.enabled;
        element<HTMLButtonElement>("[data-skills]").hidden = !frame.skills.triggerVisible;
        element<HTMLButtonElement>("[data-skills]").disabled = !frame.skills.enabled;
        element("[data-skill-panel]").hidden = !frame.skills.visible;
        const nextSkills = JSON.stringify(frame.skills);
        if (frame.skills.visible && skillPaint !== nextSkills) {
          skillPaint = nextSkills;
          element("[data-skill-fatigue]").textContent = frame.skills.fatigue;
          element("[data-skill-preview]").textContent = frame.skills.preview;
          element("[data-skill-list]").replaceChildren(
            ...frame.skills.choices.map((choice) => {
              const button = document.createElement("button");
              button.type = "button";
              button.className = "command";
              button.textContent = choice.text;
              button.setAttribute("aria-pressed", String(choice.selected));
              register(button, { kind: "skill", id: choice.id });
              button.addEventListener("click", () => dispatch({ type: "select-skill", id: choice.id }), { signal });
              return button;
            }),
          );
          options(allyTarget, frame.skills.allies);
          allyTarget.value = frame.skills.allyTargetId ?? "";
          element("[data-ally-label]").hidden = !frame.skills.allyTargetVisible;
          element<HTMLButtonElement>("[data-use-skill]").disabled = !frame.skills.useEnabled;
          appliedFocus = undefined;
        }
        element(".sequence-controls").hidden = !frame.controls.visible;
        skip.hidden = !frame.controls.skip;
        speed.value = String(frame.controls.speed);
        element("[data-skill-result]").hidden = !frame.summary.visible;
        element("[data-skill-result]").textContent = frame.summary.text;
        itemTrigger.hidden = !frame.items.visible;
        itemTrigger.disabled = !frame.items.enabled;
        itemTrigger.textContent = frame.items.label;
        const nextItems = JSON.stringify(frame.items.targets);
        if (itemPaint !== nextItems) {
          itemPaint = nextItems;
          options(itemTarget, frame.items.targets);
          appliedFocus = undefined;
        }
        itemTarget.value = frame.items.targetId ?? "";
        itemUse.disabled = !frame.items.useEnabled;
        requiredElement(dialog, "[data-item-preview]").textContent = frame.items.preview;
        if (frame.items.open && !dialog.open) dialog.showModal();
        else if (!frame.items.open && dialog.open) dialog.close();
        element("[data-result]").hidden = !frame.result.visible;
        element<HTMLButtonElement>("[data-rematch]").hidden = !frame.result.visible;
        element("[data-result-title]").textContent = frame.result.title;
        element("[data-result-detail]").textContent = frame.result.detail;
        element("[data-rematch]").textContent = frame.result.finishLabel;
        element("[data-rematch]").setAttribute("aria-label", frame.result.finishAriaLabel);
        announcement.textContent = frame.announcement;
        toast.hidden = !frame.toast.visible;
        toast.textContent = frame.toast.text;
        toast.dataset.event = frame.toast.kind;
        place();
        observe();
      }
      if (hudChanged || appliedPartyAnchor !== frame.partyAnchor) {
        appliedPartyAnchor = frame.partyAnchor;
        applyPartyAnchor();
      }
      sequence.paint(frame.sequence);
      if (frame.focus !== appliedFocus) {
        appliedFocus = frame.focus;
        if (frame.focus) focusTargets.get(focusKey(frame.focus))?.focus();
      }
      return hudChanged ? measureParty() : undefined;
    },
    settled: sequence.settled,
    dispose() {
      events.abort();
      observer.disconnect();
      sequence.dispose();
      if (dialog.open) dialog.close();
      for (const { button, label } of enemyNodes.values()) {
        button.remove();
        label.remove();
      }
      marker.remove();
      toast.remove();
      hud.remove();
    },
  };
}
