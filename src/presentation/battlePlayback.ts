import type { BattleCombatant, BattleEvent, BattleState } from "../game/battle";
import type { ItemRecoveryEvent } from "../game/items";

export type ConfirmedBattleEvent = BattleEvent | (ItemRecoveryEvent & { readonly actorId: string });
export type BattleActionEvent = Extract<ConfirmedBattleEvent, { type: "attack" | "miss" | "skill" | "item-recovery" }>;
export type BattlePlaybackPhase =
  | "actor"
  | "prepare"
  | "impact"
  | "result"
  | "settle"
  | "enemy-pause"
  | "symptom"
  | "defeat"
  | "defeat-message"
  | "outcome"
  | "finished"
  | "closed";
export interface ConfirmedBattleRecord {
  readonly before: BattleState;
  readonly after: BattleState;
  readonly events: readonly ConfirmedBattleEvent[];
}
export interface BattlePlayback {
  readonly record: ConfirmedBattleRecord;
  readonly display: BattleState;
  readonly eventIndex: number;
  readonly phase: BattlePlaybackPhase;
  /** Wall milliseconds in the current phase; the phase's speed is frozen at entry. */
  readonly phaseElapsedMs: number;
  readonly phaseDurationMs: number;
  readonly phaseSpeed: 1 | 2;
  readonly requestedSpeed: 0 | 1 | 2;
  readonly reducedMotion: boolean;
  readonly visibleCombatantIds: readonly string[];
  /** Continuous 1x cue time, independent of CSS easing and the game's logical ticks. */
  readonly cue: {
    readonly actorMs: number;
    readonly impactMs: number;
    readonly settleMs: number;
    readonly defeatMs: number;
  };
}
export type BattlePlaybackEvent =
  | { readonly type: "advance"; readonly elapsedMs: number }
  | { readonly type: "speed"; readonly speed: 0 | 1 | 2 }
  | { readonly type: "motion"; readonly reduced: boolean }
  | { readonly type: "skip" }
  | { readonly type: "close" };

const duration = {
  actor: 120,
  prepare: 140,
  impact: 80,
  result: 380,
  settle: 120,
  "enemy-pause": 360,
  symptom: 300,
  defeat: 240,
  "defeat-message": 300,
  outcome: 300,
} as const;
const emptyCue = { actorMs: 0, impactMs: 0, settleMs: 0, defeatMs: 0 };
const actionEvent = (event: ConfirmedBattleEvent): event is BattleActionEvent =>
  event.type === "attack" || event.type === "miss" || event.type === "skill" || event.type === "item-recovery";
const memberUpdate = (
  state: BattleState,
  id: string,
  update: (member: BattleCombatant) => BattleCombatant,
): BattleState => ({
  ...state,
  combatants: state.combatants.map((member) => (member.id === id ? update(member) : member)),
});

function finish(state: BattlePlayback): BattlePlayback {
  return {
    ...state,
    phase: "finished",
    display: state.record.after,
    eventIndex: state.record.events.length,
    phaseElapsedMs: 0,
    phaseDurationMs: 0,
    visibleCombatantIds: state.record.after.combatants.filter((member) => member.isAlive).map((member) => member.id),
    cue: emptyCue,
  };
}
function enterPhase(state: BattlePlayback, phase: Exclude<BattlePlaybackPhase, "finished" | "closed">): BattlePlayback {
  const phaseSpeed = state.requestedSpeed === 2 ? 2 : 1;
  const shortMotion = state.reducedMotion && (phase === "prepare" || phase === "impact" || phase === "settle");
  return {
    ...state,
    phase,
    phaseSpeed,
    phaseElapsedMs: 0,
    phaseDurationMs: shortMotion ? 0 : duration[phase] / phaseSpeed,
  };
}
function impact(state: BattlePlayback): BattlePlayback {
  const event = state.record.events[state.eventIndex];
  if (event.type === "attack" || event.type === "skill" || event.type === "item-recovery")
    return {
      ...state,
      display: memberUpdate(state.display, event.targetId, (member) => ({ ...member, hp: event.targetHpAfter })),
    };
  return state;
}
function beginEvent(state: BattlePlayback): BattlePlayback {
  let next = state;
  while (next.eventIndex < next.record.events.length) {
    const event = next.record.events[next.eventIndex];
    if (event.type === "skill-cost") {
      next = {
        ...next,
        display: memberUpdate(next.display, event.actorId, (member) => ({
          ...member,
          mentalFatigue: event.fatigueAfter,
        })),
        eventIndex: next.eventIndex + 1,
      };
      continue;
    }
    if (actionEvent(event)) {
      const actorId = event.actorId;
      const actorTeam = next.record.before.combatants.find((member) => member.id === actorId)?.team;
      const previousActions = next.record.events.slice(0, next.eventIndex).filter(actionEvent);
      const previousTeams = previousActions.map(
        (action) => next.record.before.combatants.find((member) => member.id === action.actorId)?.team,
      );
      if (actorTeam === "enemy" && previousTeams.includes("ally") && !previousTeams.includes("enemy"))
        return enterPhase({ ...next, cue: emptyCue }, "enemy-pause");
      return enterPhase({ ...next, cue: emptyCue }, "actor");
    }
    if (event.type === "symptom")
      return enterPhase(
        {
          ...next,
          cue: emptyCue,
          display: memberUpdate(next.display, event.actorId, (member) => ({
            ...member,
            hp: event.actorHpAfter,
            status: event.statusAfter,
          })),
        },
        "symptom",
      );
    if (event.type === "combatant-defeated")
      return enterPhase(
        {
          ...next,
          cue: emptyCue,
          display: memberUpdate(next.display, event.combatantId, (member) => ({
            ...member,
            isAlive: false,
            status: event.statusAfter,
          })),
        },
        "defeat",
      );
    return enterPhase({ ...next, cue: emptyCue }, "outcome");
  }
  return finish(next);
}
function completePhase(
  state: BattlePlayback,
  phase: Exclude<BattlePlaybackPhase, "finished" | "closed">,
): BattlePlayback {
  switch (phase) {
    case "actor":
      return enterPhase(state, "prepare");
    case "prepare":
      return enterPhase(impact(state), "impact");
    case "impact":
      return enterPhase(state, "result");
    case "result":
      return enterPhase(state, "settle");
    case "enemy-pause":
      return enterPhase(state, "actor");
    case "defeat": {
      const event = state.record.events[state.eventIndex] as Extract<
        ConfirmedBattleEvent,
        { type: "combatant-defeated" }
      >;
      return enterPhase(
        { ...state, visibleCombatantIds: state.visibleCombatantIds.filter((id) => id !== event.combatantId) },
        "defeat-message",
      );
    }
    case "settle":
    case "symptom":
    case "defeat-message":
    case "outcome":
      return beginEvent({ ...state, eventIndex: state.eventIndex + 1 });
  }
}
function advancePhase(state: BattlePlayback, wallMs: number): BattlePlayback {
  const cueMs = wallMs * state.phaseSpeed;
  const actor = state.phase === "actor" || state.phase === "prepare";
  const impact = state.phase === "impact" || state.phase === "result" || state.phase === "settle";
  return {
    ...state,
    phaseElapsedMs: state.phaseElapsedMs + wallMs,
    cue: {
      actorMs: state.cue.actorMs + (actor ? cueMs : 0),
      impactMs: state.cue.impactMs + (impact ? cueMs : 0),
      settleMs: state.cue.settleMs + (state.phase === "settle" ? cueMs : 0),
      defeatMs: state.cue.defeatMs + (state.phase === "defeat" ? cueMs : 0),
    },
  };
}
export function createBattlePlayback(
  record: ConfirmedBattleRecord,
  speed: 0 | 1 | 2 = 1,
  reducedMotion = false,
): BattlePlayback {
  const initial: BattlePlayback = {
    record,
    display: record.before,
    eventIndex: 0,
    phase: "finished",
    phaseElapsedMs: 0,
    phaseDurationMs: 0,
    phaseSpeed: 1,
    requestedSpeed: speed,
    reducedMotion,
    visibleCombatantIds: record.before.combatants.filter((member) => member.isAlive).map((member) => member.id),
    cue: emptyCue,
  };
  return speed === 0 ? finish(initial) : reduceBattlePlayback(beginEvent(initial), { type: "advance", elapsedMs: 0 });
}
export function reduceBattlePlayback(state: BattlePlayback, event: BattlePlaybackEvent): BattlePlayback {
  if (state.phase === "closed") return state;
  if (event.type === "close") return { ...state, phase: "closed", visibleCombatantIds: [], cue: emptyCue };
  if (event.type === "motion") return { ...state, reducedMotion: event.reduced };
  if (event.type === "speed")
    return event.speed === 0 ? finish({ ...state, requestedSpeed: 0 }) : { ...state, requestedSpeed: event.speed };
  if (event.type === "skip") return finish(state);
  let next = state,
    remaining = event.elapsedMs;
  while (next.phase !== "finished" && next.phase !== "closed") {
    const untilBoundary = next.phaseDurationMs - next.phaseElapsedMs;
    if (remaining < untilBoundary) return advancePhase(next, remaining);
    next = completePhase(advancePhase(next, untilBoundary), next.phase);
    remaining -= untilBoundary;
  }
  return next;
}

/** CSS keyframes are sampled with 1x currentTime, so changing the next phase's speed cannot jump a cue. */
export function projectBattleCue(state: BattlePlayback) {
  const event = state.record.events[state.eventIndex];
  const visible =
    state.phase === "actor" ||
    state.phase === "prepare" ||
    state.phase === "impact" ||
    state.phase === "result" ||
    state.phase === "settle";
  const action = event && actionEvent(event) ? event : null;
  return {
    visible,
    phase: visible ? state.phase : null,
    motion: !state.reducedMotion,
    actorId: action?.actorId ?? null,
    targetId: action?.targetId ?? null,
    kind:
      action?.type === "miss" || (action?.type === "skill" && !action.hit)
        ? "miss"
        : action?.type === "item-recovery" || (action?.type === "skill" && action.effect === "hp-recovery")
          ? "heal"
          : "damage",
    actorTimeMs: state.phase === "actor" || state.phase === "prepare" ? state.cue.actorMs : state.cue.impactMs,
    impactTimeMs: state.cue.impactMs,
    numberTimeMs: state.phase === "settle" ? state.cue.settleMs : state.cue.impactMs,
  } as const;
}
