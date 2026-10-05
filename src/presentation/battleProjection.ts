import type { BattleCombatantDefinition } from "../game/battle";
import { type SkillCatalog, skillById } from "../game/skills";
import type { BattlePlayback } from "./battlePlayback";
import { formatAmount } from "./statusText";

export interface BattleActorFrame {
  readonly id: string;
  readonly visible: boolean;
  readonly opacity: number;
  readonly emissive: readonly [number, number, number];
}

/** Initial authored/preview combatants have no playback yet. The native renderer only applies this frame. */
export function projectInitialBattleActors(
  combatants: readonly BattleCombatantDefinition[],
): readonly BattleActorFrame[] {
  return combatants.map((member) => ({ id: member.id, visible: member.hp > 0, opacity: 1, emissive: [1, 1, 1] }));
}

/** A canvas samples the playback at its render time, independently of the last DOM paint. */
export function projectBattleActors(state: BattlePlayback): readonly BattleActorFrame[] {
  const event = state.record.events[state.eventIndex];
  return state.record.before.combatants.map((member): BattleActorFrame => {
    const visible = state.visibleCombatantIds.includes(member.id);
    const normal: BattleActorFrame = { id: member.id, visible, opacity: 1, emissive: [1, 1, 1] };
    if (event?.type === "combatant-defeated" && event.combatantId === member.id && state.phase === "defeat")
      return {
        ...normal,
        visible: visible && !state.reducedMotion,
        opacity: state.reducedMotion ? 0 : 1 - state.cue.defeatMs / 240,
      };
    if (state.reducedMotion || !event) return normal;
    if (
      state.phase === "prepare" &&
      (event.type === "attack" || event.type === "miss" || event.type === "skill" || event.type === "item-recovery") &&
      event.actorId === member.id
    ) {
      const pulse = Math.sin((Math.PI * state.phaseElapsedMs * state.phaseSpeed) / 140) * 0.5;
      return { ...normal, emissive: [1, 1 - 0.28 * pulse, 1 - 0.72 * pulse] };
    }
    if (
      state.phase === "result" &&
      (event.type === "attack" || (event.type === "skill" && event.hit && event.effect === "damage")) &&
      event.targetId === member.id
    ) {
      const progress = (state.phaseElapsedMs * state.phaseSpeed) / 240;
      if (progress < 1) {
        const pulse = Math.sin(Math.PI * progress) * 0.8;
        return { ...normal, emissive: [1, 1 - 0.58 * pulse, 1 - 0.68 * pulse] };
      }
    }
    return normal;
  });
}

export function battleActionText(state: BattlePlayback, catalog?: SkillCatalog) {
  const event = state.record.events[state.eventIndex];
  if (
    !event ||
    (event.type !== "attack" && event.type !== "miss" && event.type !== "skill" && event.type !== "item-recovery")
  )
    return { label: "", result: "" };
  return {
    label:
      event.type === "item-recovery"
        ? "HP回復品"
        : event.type === "skill"
          ? catalog
            ? skillById(catalog, event.skillId).name
            : event.skillId
          : "通常攻撃",
    result:
      event.type === "miss" || (event.type === "skill" && !event.hit)
        ? "外れ"
        : event.type === "attack"
          ? `−${formatAmount(event.damage)}`
          : event.type === "skill" && event.effect === "damage"
            ? `−${formatAmount(event.amount)}`
            : `${formatAmount(event.amount)} 回復`,
  };
}
