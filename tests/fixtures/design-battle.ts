import { mount } from "svelte";
import type { BattleScreenRect } from "../../src/presentation/battleGeometry";
import { type BattleViewFrame, projectBattleView } from "../../src/presentation/battleViewProjection";
import { projectSymptoms, type SymptomKind } from "../../src/presentation/symptomProjection";
import { createBattleView } from "../../src/web/battleView.svelte.ts";
import BattleSurface from "../../src/web/components/BattleSurface.svelte";
import { battlePictures } from "../battlePictures";
import { isolateDesignComponent } from "./design-isolation";
import type { DesignCase } from "./design-view";

const text = (props: Record<string, unknown>, key: string, fallback: string) => String(props[key] ?? fallback);
const number = (props: Record<string, unknown>, key: string, fallback: number) => Number(props[key] ?? fallback);

function frameFor(props: Record<string, unknown>, part: string): BattleViewFrame {
  const picture = battlePictures("attack");
  const base = projectBattleView(picture.initial, picture.input);
  const defeated = props.defeated === true;
  const enabled = props.disabled !== true;
  const state = text(props, "state", "waiting");
  const hp = text(props, "hp", "partial");
  const maximum = hp === "reduced" ? 21 : 30;
  const amount = hp === "zero" || defeated || state === "defeated" ? 0 : hp === "full" ? maximum : 10;
  const symptom = text(props, "symptom", "mentalFatigue") as SymptomKind;
  const symptoms = projectSymptoms(
    {
      physicalFatigue: props.symptoms === "multiple" || symptom === "physicalFatigue" ? 50 : 0,
      haze: props.symptoms === "multiple" || symptom === "haze" ? 50 : 0,
      incapacityRecoverySteps: props.symptoms === "multiple" || symptom === "incapacity" ? 6 : null,
    },
    props.symptoms === "multiple" || symptom === "mentalFatigue" ? 25 : 0,
    props.open ? [symptom] : [],
  );
  return {
    ...base,
    focus: null,
    partyAnchor: null,
    skillBattle: props.skillBattle !== false,
    markerId: part === "marker" && props.visible !== false ? "slime" : null,
    markerAngle: part === "marker" && props.visible !== false ? number(props, "angle", 0.1) : null,
    queue: [
      {
        ...base.queue[0],
        id: props.enemy ? "slime" : "player",
        name: text(props, "name", props.enemy ? "スライム A" : "ロッシ"),
        portrait: props.enemy ? "enemies/slime-blue.png" : "characters/rossi/face.png",
        current: props.current === true,
        enemy: props.enemy === true,
        ticks: number(props, "ticks", 125),
      },
    ],
    allies: [
      {
        ...base.allies[0],
        name: text(props, "name", "ロッシ"),
        active: state === "active",
        defeated: state === "defeated",
        hp: String(amount),
        maximum,
        fraction: amount / maximum,
        status: state === "active" ? "" : state === "defeated" ? "戦闘不能" : "待機",
        symptoms: part === "symptom" || props.symptoms ? symptoms : [],
      },
    ],
    enemies: [
      {
        ...base.enemies[0],
        name: text(props, "name", "スライム A"),
        hp: `${amount} / ${maximum}`,
        fraction: amount / maximum,
        selected: props.selected === true,
        defeated,
        visible: props.visible !== false,
        pressed: props.pressed === true,
        disabled: !enabled,
      },
    ],
    attack: { visible: true, enabled },
    skills: {
      ...base.skills,
      triggerVisible: part !== "skills",
      enabled,
      visible: part === "skills",
      fatigue: text(props, "fatigue", "精神疲労 25（軽度） · 試用値"),
      choices: [{ id: "test-heal", text: text(props, "label", "回復術"), selected: props.selected === true }],
      preview: text(props, "preview", "味方1人のHPを回復します。"),
      allyTargetVisible: true,
      allyTargetId: text(props, "target", "player"),
      allies: [
        { id: "player", text: `ロッシ · HP ${amount} / ${maximum}` },
        { id: "gilberta", text: "ギルベルタ · HP 30 / 30" },
      ],
      useEnabled: enabled,
    },
    items: {
      ...base.items,
      visible: true,
      enabled,
      label: text(props, "label", "物品（HP回復品 ×3）"),
      open: part === "item",
      targets: [{ id: "player", text: `ロッシ · HP ${amount}/${maximum}` }],
      targetId: text(props, "target", "player"),
      preview: text(
        props,
        "preview",
        hp === "full"
          ? "HPは満タンです。使用できません。"
          : props.unavailable
            ? "この対象には使用できません。"
            : "回復見込み +20 HP · 残り3個",
      ),
      useEnabled: enabled,
    },
    controls: { visible: true, skip: true, speed: number(props, "speed", 1) as 0 | 1 | 2 },
    result: {
      ...base.result,
      visible: part === "result",
      title: props.outcome === "defeat" ? "戦闘に敗北しました" : "戦闘に勝利しました",
      detail: props.outcome === "defeat" ? "味方が全員戦闘不能になりました。" : "敵をすべて倒しました。",
      finishLabel: text(props, "label", "再戦する"),
    },
    summary: {
      visible: part === "summary",
      text: text(props, "summary", "HP回復品：ロッシのHPを+20回復 · 精神疲労は変化なし"),
    },
    toast: { visible: false, text: "", kind: "" },
    sequence: { ...base.sequence, visible: false },
  };
}

async function render(root: HTMLElement, props: Record<string, unknown>, part: string, selector: string) {
  mount(BattleSurface, {
    target: root,
    props: {
      ready: part !== "loading" || props.ready === true,
      error: props.error === true,
      message: text(props, "message", "戦闘を準備しています…"),
    },
  });
  const board = root.querySelector<HTMLDivElement>(".game-board");
  if (!board) throw new Error("Battle design board is required");
  let nominal: DOMRect | undefined;
  if (part !== "loading") {
    // Public 2D projection inputs place only UI. The fixture never starts a renderer.
    const rects: Record<string, BattleScreenRect> = {
      player: { left: 300, top: 460, width: 120, height: 220, markerX: 360, markerY: 460, spriteTop: 460 },
      slime: { left: 1100, top: 460, width: 180, height: 160, markerX: 1190, markerY: 460, spriteTop: 460 },
    };
    const view = createBattleView(
      board,
      { refreshCombatantScreenPositions() {}, getCombatantScreenRect: (id) => rects[id] },
      () => false,
    );
    // A transparent fixture anchor preserves the component's natural region for absent
    // public states. It has no UI paint and does not force the hidden component visible.
    if (props.visible === false) {
      view.paint(frameFor({ ...props, visible: true }, part));
      await view.settled();
      nominal = root.querySelector(selector)?.getBoundingClientRect();
    }
    view.paint(frameFor(props, part));
    await view.settled();
  }
  if (props.blurAutofocus === true && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (props.captureAnchor === true || props.visible === false) {
    const rect = nominal ?? root.querySelector(selector)?.getBoundingClientRect();
    if (!rect?.width || !rect.height) throw new Error(`Battle capture anchor has no nominal region: ${selector}`);
    const anchor = document.createElement("div");
    anchor.dataset.designBattleAnchor = "";
    anchor.style.cssText = `position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none`;
    root.append(anchor);
    const placed = anchor.getBoundingClientRect();
    const residual = { x: rect.x - placed.x, y: rect.y - placed.y };
    if (residual.x || residual.y) anchor.style.transform = `translate(${residual.x}px, ${residual.y}px)`;
  }
  isolateDesignComponent(root, text(props, "isolate", selector));
}

export const cases: Record<string, DesignCase> = {
  queue: (root, props) => render(root, props, "queue", ".queue-row"),
  timeline: (root, props) => render(root, props, "queue", ".timeline"),
  ally: (root, props) => render(root, props, "ally", ".ally-card"),
  commands: (root, props) => render(root, props, "commands", ".commands"),
  attack: (root, props) => render(root, props, "commands", "[data-attack]"),
  skillsTrigger: (root, props) => render(root, props, "commands", "[data-skills]"),
  skills: (root, props) => render(root, props, "skills", ".skill-panel"),
  skillChoice: (root, props) => render(root, props, "skills", "[data-skill-id]"),
  allyTarget: (root, props) => render(root, props, "skills", "[data-ally-target]"),
  skillUse: (root, props) => render(root, props, "skills", "[data-use-skill]"),
  skillBack: (root, props) => render(root, props, "skills", "[data-cancel-skill]"),
  itemTrigger: (root, props) => render(root, props, "commands", "[data-focus=item]"),
  item: (root, props) => render(root, props, "item", ".item-dialog"),
  itemTarget: (root, props) => render(root, props, "item", "[data-item-target]"),
  itemUse: (root, props) => render(root, props, "item", "[data-item-use]"),
  itemBack: (root, props) => render(root, props, "item", "[data-item-cancel]"),
  speed: (root, props) => render(root, props, "commands", "[data-sequence-speed]"),
  skip: (root, props) => render(root, props, "commands", "[data-sequence-skip]"),
  enemy: (root, props) => render(root, props, "enemy", ".enemy-world-label"),
  hitbox: (root, props) => render(root, props, "enemy", ".enemy-hitbox"),
  symptom: (root, props) => render(root, props, "symptom", `[data-symptom=${text(props, "symptom", "mentalFatigue")}]`),
  result: (root, props) => render(root, props, "result", ".battle-result"),
  finish: (root, props) => render(root, props, "result", "[data-rematch]"),
  loading: (root, props) => render(root, props, "loading", ".loading"),
};
