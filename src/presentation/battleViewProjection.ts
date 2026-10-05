import { itemCatalog, recoveryItemId } from "../content/itemSettings";
import { getBattleUpcomingActions } from "../game/battle";
import { previewRecoveryItem } from "../game/itemUse";
import { mentalFatigueMultiplier } from "../game/mentalFatigue";
import { activeSkillBaseAmount, mentalFatigueAffectedQuantity, skillById } from "../game/skills";
import { canParticipate, effectiveMaxHp } from "../game/status";
import { projectBattleMarkerAngle } from "./battleGeometry";
import {
  type BattleInput,
  type BattleModel,
  battleCanAct,
  battleItemUsable,
  battleMarkerTarget,
  battleSkills,
} from "./battleModel";
import { type BattlePlayback, type ConfirmedBattleEvent, projectBattleCue } from "./battlePlayback";
import { battleActionText } from "./battleProjection";
import { formatAmount, loadSymptomText, mentalFatigueText, symptomNames } from "./statusText";
import { projectSymptoms } from "./symptomProjection";

const appearances: Readonly<Record<string, { readonly name: string; readonly portrait: string }>> = {
  player: { name: "ロッシ", portrait: "characters/rossi/face.png" },
  gilberta: { name: "ギルベルタ", portrait: "characters/gilberta/face.png" },
  slime: { name: "スライム A", portrait: "enemies/slime-blue.png" },
  "slime-2": { name: "スライム B", portrait: "enemies/slime-blue.png" },
};
export interface BattleAppearance {
  readonly names?: Readonly<Record<string, string>>;
  readonly finishLabel?: string;
  readonly finishAriaLabel?: string;
}

export type BattleHudState = Omit<BattleModel, "markerElapsedMs" | "playback"> & {
  readonly playback: Omit<BattlePlayback, "phaseElapsedMs" | "cue">;
};

/** Semantic HUD projection has no dependency on continuous animation clocks. */
export function projectBattleHud(state: BattleHudState, input: BattleInput, appearance: BattleAppearance = {}) {
  const playback = state.playback;
  const name = (id: string) => {
    const label = appearance.names?.[id] ?? appearances[id]?.name ?? id;
    return !appearances[id] &&
      playback.record.before.combatants.some((member) => member.id === id && member.team === "ally")
      ? `${label}（仮表示）`
      : label;
  };
  const portrait = (id: string) => appearances[id]?.portrait ?? "enemies/slime-blue.png";
  const canAct = battleCanAct(state, input);
  const replaying = playback.phase !== "finished" && playback.phase !== "closed";
  const panel = state.panel.kind === "item" ? state.panel.returnPanel : state.panel;
  const skills = battleSkills(input);
  const skill = panel.kind === "skills" ? skills.find((entry) => entry.id === panel.skillId) : undefined;
  const actor = input.battle?.combatants.find((member) => member.id === input.battle?.currentActorId);
  const allEnemies = panel.kind === "skills" && skill?.target === "all-enemies";
  const marker = battleMarkerTarget(state, input);
  const prompt = (id: string | null, selected: boolean) =>
    id === null
      ? "選択できる敵がいません。"
      : selected
        ? `${name(id)}を攻撃対象に選択しました。スキルを選択します。`
        : `対象：${name(id)}。スキルを選択します。敵をクリックすると対象を切り替えます。`;
  const targetPrompt = prompt(state.selectedEnemyId, state.targetAnnouncement === "selected");
  const symptomText = (event: Extract<ConfirmedBattleEvent, { type: "symptom" }>) =>
    `${name(event.actorId)}の${symptomNames[event.kind]}：${formatAmount(event.before)} → ${loadSymptomText(event.kind, event.after)}`;
  const eventText = (event: ConfirmedBattleEvent): string => {
    if (event.type === "skill-cost") return "";
    if (event.type === "symptom") return symptomText(event);
    if (event.type === "combatant-defeated") return `${name(event.combatantId)}は戦闘不能になった`;
    if (event.type === "battle-ended") return event.outcome === "victory" ? "戦闘に勝利しました" : "戦闘に敗北しました";
    const label =
      event.type === "item-recovery"
        ? "HP回復品"
        : event.type === "skill"
          ? input.rules
            ? skillById(input.rules.catalog, event.skillId).name
            : event.skillId
          : "通常攻撃";
    return `${name(event.actorId)} · ${label} → ${name(event.targetId)}${event.type === "skill" ? ` · ${event.hitIndex}発目` : ""}`;
  };
  const resultText = (entry: ConfirmedBattleEvent): string => {
    if (entry.type === "item-recovery")
      return `HP回復品：${name(entry.targetId)}のHPを${formatAmount(entry.amount)}回復 · 精神疲労は変化なし`;
    if (entry.type !== "attack" && entry.type !== "miss" && entry.type !== "skill") return eventText(entry);
    const label =
      entry.type === "skill"
        ? input.rules
          ? skillById(input.rules.catalog, entry.skillId).name
          : entry.skillId
        : "通常攻撃";
    const result =
      entry.type === "miss" || (entry.type === "skill" && !entry.hit)
        ? "外れ"
        : entry.type === "attack"
          ? `−${formatAmount(entry.damage)}`
          : entry.effect === "damage"
            ? `−${formatAmount(entry.amount)}`
            : `${formatAmount(entry.amount)} 回復`;
    return `${name(entry.actorId)} · ${label}：${name(entry.targetId)} ${result}${entry.type === "skill" ? ` · ${entry.hitIndex}発目` : ""}`;
  };
  const event = playback.record.events[playback.eventIndex];
  const previousEvent = playback.record.events
    .slice(0, playback.eventIndex)
    .reverse()
    .find((entry) => entry.type !== "skill-cost");
  // Defeat fades the last action before publishing the separate defeat message.
  const toastEvent = playback.phase === "defeat" ? previousEvent : event;
  const heldAnnouncement = previousEvent
    ? resultText(previousEvent)
    : state.actionPrompt
      ? prompt(state.actionPrompt.enemyId, state.actionPrompt.selected)
      : targetPrompt;
  const phaseAnnouncement =
    playback.phase === "actor" ||
    playback.phase === "prepare" ||
    playback.phase === "enemy-pause" ||
    playback.phase === "defeat"
      ? heldAnnouncement
      : event
        ? resultText(event)
        : targetPrompt;
  const skillEvents = playback.record.events.filter((entry) => entry.type === "skill");
  const firstSkill = skillEvents[0];
  const cost = playback.record.events.find((entry) => entry.type === "skill-cost");
  const item = playback.record.events.find((entry) => entry.type === "item-recovery");
  let summary = firstSkill
    ? `${input.rules ? skillById(input.rules.catalog, firstSkill.skillId).name : firstSkill.skillId}：${skillEvents.map((entry) => `${name(entry.targetId)} ${entry.hitIndex}発目 ${entry.hit ? `${formatAmount(entry.amount)}${entry.effect === "damage" ? "ダメージ" : "回復"}` : "外れ"}`).join(" · ")}${cost ? ` · 精神疲労 ${formatAmount(cost.fatigueBefore)} → ${formatAmount(cost.fatigueAfter)}` : ""}`
    : item
      ? `HP回復品：${name(item.targetId)}のHPを${formatAmount(item.amount)}回復 · 精神疲労は変化なし`
      : "";
  for (const entry of playback.record.events) if (entry.type === "symptom") summary += ` · ${symptomText(entry)}`;
  let preview = "使用するスキルを選択";
  if (skill && actor && input.rules) {
    const multiplier = mentalFatigueAffectedQuantity(skill)
      ? mentalFatigueMultiplier(actor.mentalFatigue, input.rules.fatigue)
      : 1;
    const amount =
      activeSkillBaseAmount(skill, {
        attackPower: actor.attackPower,
        maxHp: effectiveMaxHp(actor.maxHp, actor.status),
      }) * multiplier;
    preview = `${skill.description} 予測${skill.effect.type === "damage" ? "ダメージ" : "回復量"} ${formatAmount(amount)}（倍率 ${formatAmount(multiplier)}） · 使用後疲労 +${formatAmount(skill.mentalFatigueIncrease)}。命中・HP上限により実効果は変わります。`;
    if (skill.effect.type === "damage")
      preview += ` 1体・1発あたり ${formatAmount(amount)} × ${skill.effect.hitCount ?? 1}回（撃破時は打切り）。`;
    if (skill.target === "all-enemies")
      preview += ` 対象：生存中の敵全体（${input.battle?.combatants
        .filter((entry) => entry.team !== actor.team && entry.isAlive)
        .map((entry) => name(entry.id))
        .join("、")}）`;
    if (skill.target === "single-enemy")
      preview += ` 対象：${state.selectedEnemyId ? name(state.selectedEnemyId) : "なし"}`;
  }
  const targets =
    input.battle?.combatants
      .filter((member) => member.team === "ally")
      .map((member) => ({
        id: member.id,
        text: `${name(member.id)} · HP ${member.hp}/${effectiveMaxHp(member.maxHp, member.status)}`,
      })) ?? [];
  const itemPanel = state.panel.kind === "item" ? state.panel : null;
  const itemPreview = previewRecoveryItem(
    input.battle?.combatants.find((member) => member.id === itemPanel?.targetId),
    recoveryItemId,
    itemCatalog,
  );
  return {
    scene: state.scene,
    focus: state.focus,
    partyAnchor: state.partyAnchor,
    markerId: marker,
    skillBattle: input.rules !== undefined,
    queue: getBattleUpcomingActions(playback.display, 6).map((action, index) => {
      const member = playback.display.combatants.find((entry) => entry.id === action.id);
      const current = index === 0 && action.id === playback.display.currentActorId;
      const ticks = Math.max(0, action.time - playback.display.logicalTime);
      return {
        id: action.id,
        name: name(action.id),
        portrait: portrait(action.id),
        current,
        enemy: member?.team === "enemy",
        ticks,
        label: current ? name(action.id) : `${name(action.id)}、次の行動まで ${ticks} tick`,
      };
    }),
    allies: playback.display.combatants
      .filter((member) => member.team === "ally")
      .map((member) => {
        const maximum = effectiveMaxHp(member.maxHp, member.status);
        return {
          id: member.id,
          name: name(member.id),
          portrait: portrait(member.id),
          hp: formatAmount(member.hp),
          maximum,
          fraction: member.hp / maximum,
          active: member.id === playback.display.currentActorId,
          defeated: !member.isAlive,
          status: !member.isAlive ? "戦闘不能" : member.id === playback.display.currentActorId ? "" : "待機",
          label: `${name(member.id)}、HP ${formatAmount(member.hp)}/${maximum}${member.isAlive ? "" : "、戦闘不能"}`,
          symptoms: projectSymptoms(
            member.status,
            member.mentalFatigue,
            state.disclosures.filter((entry) => entry.id === member.id).map((entry) => entry.symptom),
          ),
        };
      }),
    enemies: playback.display.combatants
      .filter((member) => member.team === "enemy")
      .map((member) => ({
        id: member.id,
        name: name(member.id),
        hp: `${formatAmount(member.hp)} / ${member.maxHp}`,
        fraction: member.hp / member.maxHp,
        label: `${name(member.id)}、HP ${formatAmount(member.hp)}/${member.maxHp}${member.isAlive ? "" : "、戦闘不能"}`,
        visible: playback.visibleCombatantIds.includes(member.id),
        defeated: !member.isAlive,
        selected: member.isAlive && (allEnemies || marker === member.id),
        pressed: allEnemies ? member.isAlive : state.selectedEnemyId === member.id,
        disabled: !canAct || allEnemies || replaying || input.battle?.outcome !== "ongoing" || !member.isAlive,
      })),
    attack: {
      visible: panel.kind !== "skills" && input.basicAttack,
      enabled: canAct && state.selectedEnemyId !== null,
    },
    skills: {
      triggerVisible: input.rules !== undefined && panel.kind !== "skills",
      enabled: canAct,
      visible: panel.kind === "skills" && canAct,
      fatigue: `精神疲労 ${mentalFatigueText(actor?.mentalFatigue ?? 0)} · 試用値`,
      choices: skills.map((entry) => ({
        id: entry.id,
        text: entry.name,
        selected: panel.kind === "skills" && panel.skillId === entry.id,
      })),
      preview,
      allyTargetVisible: skill?.target === "single-ally",
      allyTargetId: panel.kind === "skills" ? panel.allyId : null,
      allies:
        input.battle?.combatants
          .filter((member) => member.team === actor?.team && canParticipate(member.hp, member.status))
          .map((member) => ({
            id: member.id,
            text: `${name(member.id)} · HP ${formatAmount(member.hp)} / ${formatAmount(effectiveMaxHp(member.maxHp, member.status))}`,
          })) ?? [],
      useEnabled: skill !== undefined,
    },
    items: {
      visible: input.items,
      label: `物品（HP回復品 ×${input.itemCount}）`,
      enabled: input.itemCount > 0 && canAct,
      open: itemPanel !== null,
      targets,
      targetId: itemPanel?.targetId ?? null,
      preview:
        itemPanel?.message ||
        (itemPreview.usable
          ? `回復見込み +${itemPreview.amount} HP · 残り${input.itemCount}個`
          : itemPreview.reason === "no-recovery"
            ? "HPは満タンです。使用できません。"
            : "この対象には使用できません。"),
      useEnabled: battleItemUsable(state, input),
    },
    controls: { visible: input.rules !== undefined || replaying, skip: replaying, speed: playback.requestedSpeed },
    result: {
      visible: playback.phase === "finished" && playback.record.after.outcome !== "ongoing",
      title: playback.record.after.outcome === "victory" ? "戦闘に勝利しました" : "戦闘に敗北しました",
      detail:
        playback.record.after.outcome === "victory" ? "敵をすべて倒しました。" : "味方が全員戦闘不能になりました。",
      finishLabel: appearance.finishLabel ?? "再戦する",
      finishAriaLabel: appearance.finishAriaLabel ?? "戦闘を再戦する",
    },
    summary: {
      visible: playback.phase === "finished" && (firstSkill !== undefined || item !== undefined),
      text: summary,
    },
    announcement:
      state.message ||
      (replaying
        ? phaseAnnouncement
        : playback.record.after.outcome === "victory"
          ? "勝利です。再戦できます。"
          : playback.record.after.outcome === "defeat"
            ? "敗北です。再戦できます。"
            : targetPrompt),
    toast: {
      visible: replaying && playback.phase !== "enemy-pause" && toastEvent !== undefined,
      text: toastEvent ? eventText(toastEvent) : "",
      kind: toastEvent?.type ?? "",
    },
  };
}
export function projectBattleMotion(state: BattleModel, input: BattleInput) {
  return {
    markerAngle: battleMarkerTarget(state, input) ? projectBattleMarkerAngle(state.markerElapsedMs) : null,
    sequence: { ...projectBattleCue(state.playback), ...battleActionText(state.playback, input.rules?.catalog) },
  };
}

/** Complete explicit frame for direct-state tests and one-off projections. */
export function projectBattleView(state: BattleModel, input: BattleInput, appearance: BattleAppearance = {}) {
  return { ...projectBattleHud(state, input, appearance), ...projectBattleMotion(state, input) };
}
export type BattleHudFrame = ReturnType<typeof projectBattleHud>;
export type BattleMotionFrame = ReturnType<typeof projectBattleMotion>;
export type BattleViewFrame = ReturnType<typeof projectBattleView>;
