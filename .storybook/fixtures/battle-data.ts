import { type BattleViewFrame, projectBattleView } from "../../src/presentation/battleViewProjection";
import { projectSymptoms, type SymptomKind } from "../../src/presentation/symptomProjection";
import { battlePictures } from "../../tests/battlePictures";

const text = (props: Record<string, unknown>, key: string, fallback: string) => String(props[key] ?? fallback);
const number = (props: Record<string, unknown>, key: string, fallback: number) => Number(props[key] ?? fallback);

export function battleStoryFrame(props: Record<string, unknown> = {}, part = "commands"): BattleViewFrame {
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
