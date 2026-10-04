export type TimedActionKind = "town-exploration" | "dungeon-expedition";
export interface TimedAction {
  readonly id: number;
  readonly kind: TimedActionKind;
}
export interface ActionClock {
  readonly elapsedHalfDays: number;
  readonly recoverySteps: number;
  readonly nextActionId: number;
  readonly pendingAction: TimedAction | null;
}
/** Provisional story duration; recovery is counted independently in action steps. */
export const ACTION_HALF_DAYS = 1;
export function createActionClock(): ActionClock {
  return { elapsedHalfDays: 0, recoverySteps: 0, nextActionId: 1, pendingAction: null };
}
export function getCalendar(clock: ActionClock): { readonly day: number; readonly period: "day" | "night" } {
  return { day: Math.floor(clock.elapsedHalfDays / 2) + 1, period: clock.elapsedHalfDays % 2 === 0 ? "day" : "night" };
}
export function beginTimedAction(clock: ActionClock, kind: TimedActionKind): ActionClock {
  if (clock.pendingAction !== null) return clock;
  return { ...clock, nextActionId: clock.nextActionId + 1, pendingAction: { id: clock.nextActionId, kind } };
}
export interface ActionCompletion extends TimedAction {
  readonly calendarHalfDays: number;
  readonly recoverySteps: number;
}
export function completeTimedAction(clock: ActionClock): {
  readonly clock: ActionClock;
  readonly completion?: ActionCompletion;
} {
  const action = clock.pendingAction;
  if (action === null) return { clock };
  const recoverySteps = action.kind === "town-exploration" ? 1 : 0;
  return {
    clock: {
      ...clock,
      pendingAction: null,
      elapsedHalfDays: clock.elapsedHalfDays + ACTION_HALF_DAYS,
      recoverySteps: clock.recoverySteps + recoverySteps,
    },
    completion: { ...action, calendarHalfDays: ACTION_HALF_DAYS, recoverySteps },
  };
}
