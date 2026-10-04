import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import { type CharacterDefinition, characterById, type PartyState } from "../game/party";
import { canParticipate, effectiveHitRate, effectiveMaxHp, healthyStatus } from "../game/status";
import { type CharacterDetailsContext, characterLearning, learnedSkillText } from "../web/characterDetailsText";
import { formatAmount, loadSymptomText, mentalFatigueText, symptomLabel } from "../web/sessionFeedback";
import { characterPortraitPath } from "./characterPortrait";

export interface CharacterDetailsInput {
  readonly characters: readonly CharacterDefinition[];
  readonly party: PartyState;
  readonly context?: CharacterDetailsContext;
}

export function projectCharacterDetails(input: CharacterDetailsInput, id: string) {
  const member = input.party.members.find((entry) => entry.id === id);
  if (!member) return undefined;
  const { context } = input;
  const character = characterById(context?.characters ?? input.characters, id);
  const base = context?.baseCharacters.find((entry) => entry.id === id);
  const learning = context ? characterLearning(id, context) : undefined;
  const status = member.status ?? healthyStatus();
  const maxHp = effectiveMaxHp(character.maxHp, status);
  const baseHit = effectiveHitRate(character.hitRate, healthyStatus());
  const hit = effectiveHitRate(character.hitRate, status);
  const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`;
  const stats: readonly (readonly [string, string, string])[] = [
    [
      "HP",
      `${formatAmount(member.hp)} / ${formatAmount(maxHp)}`,
      maxHp !== character.maxHp
        ? [
            base ? `基礎最大HP ${formatAmount(base.maxHp)}` : "",
            `症状前最大HP ${formatAmount(character.maxHp)}${context?.growth ? "（成長・パッシブ込み）" : ""}`,
            "肉体疲労による低下",
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
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
    ...(["physicalFatigue", "haze"] as const).map(
      (kind) =>
        [
          kind === "physicalFatigue" ? "肉体疲労" : "朦朧",
          loadSymptomText(kind, status[kind]),
          `上限 ${loadSymptomDefinition.symptoms[kind].cap} · 街探索1回につき ${loadSymptomDefinition.symptoms[kind].townRecovery} 回復`,
        ] as const,
    ),
  ];
  return {
    id,
    name: character.name,
    portrait: characterPortraitPath(id),
    stats,
    skills:
      context && learning?.learned
        ? learning.learned.map((learned) => learnedSkillText(context.rules.catalog, learned))
        : [],
    emptySkills: learning?.learned === undefined ? "習得情報は未接続です。" : "習得スキルなし",
    symptoms: symptomLabel(status),
    unavailable: canParticipate(member.hp, status) ? "" : "戦闘に参加できません。街探索で回復を進められます。",
  };
}

export type CharacterDetailsView = NonNullable<ReturnType<typeof projectCharacterDetails>>;
export type DetailsFocus =
  | { readonly kind: "back" }
  | { readonly kind: "information" }
  | { readonly kind: "opener"; readonly characterId: string };

export interface CharacterDetailsModel {
  readonly active: boolean;
  readonly dialog: (CharacterDetailsView & { readonly portraitFailed: boolean }) | null;
  readonly generation: number;
  readonly focus: DetailsFocus | null;
  readonly scrollTop: number;
}

export type CharacterDetailsEvent =
  | { readonly type: "open"; readonly characterId: string; readonly input: CharacterDetailsInput }
  | { readonly type: "close" }
  | { readonly type: "disposed" }
  | { readonly type: "portrait-failed"; readonly generation: number }
  | { readonly type: "focused"; readonly target: DetailsFocus }
  | { readonly type: "scrolled"; readonly scrollTop: number }
  | { readonly type: "key"; readonly key: string; readonly shift: boolean };

export type CharacterDetailsInteraction = Exclude<CharacterDetailsEvent, { type: "open" } | { type: "disposed" }>;

export const createCharacterDetailsModel = (): CharacterDetailsModel => ({
  active: true,
  dialog: null,
  generation: 0,
  focus: null,
  scrollTop: 0,
});

export function reduceCharacterDetails(
  state: CharacterDetailsModel,
  event: CharacterDetailsEvent,
): {
  readonly state: CharacterDetailsModel;
  readonly handled: boolean;
} {
  if (event.type === "disposed")
    return { state: { ...state, active: false, dialog: null, focus: null }, handled: true };
  if (!state.active) return { state, handled: false };
  if (event.type === "open") {
    if (state.dialog) return { state, handled: false };
    const dialog = projectCharacterDetails(event.input, event.characterId);
    return dialog
      ? {
          state: {
            active: true,
            dialog: { ...dialog, portraitFailed: false },
            generation: state.generation + 1,
            focus: { kind: "back" },
            scrollTop: 0,
          },
          handled: true,
        }
      : { state, handled: false };
  }
  if (!state.dialog) return { state, handled: false };
  if (event.type === "close") {
    return {
      state: { ...state, dialog: null, focus: { kind: "opener", characterId: state.dialog.id } },
      handled: true,
    };
  }
  if (event.type === "portrait-failed") {
    return event.generation === state.generation
      ? { state: { ...state, dialog: { ...state.dialog, portraitFailed: true } }, handled: true }
      : { state, handled: false };
  }
  if (event.type === "focused") {
    return {
      state: state.focus?.kind === event.target.kind ? state : { ...state, focus: event.target },
      handled: true,
    };
  }
  if (event.type === "scrolled") {
    return {
      state: state.scrollTop === event.scrollTop ? state : { ...state, scrollTop: event.scrollTop },
      handled: true,
    };
  }
  if (event.type === "key") {
    if (event.key === "Escape") {
      return reduceCharacterDetails(state, { type: "close" });
    }
    if (event.key === "Tab") {
      return {
        state: { ...state, focus: { kind: state.focus?.kind === "back" ? "information" : "back" } },
        handled: true,
      };
    }
  }
  return { state, handled: false };
}
