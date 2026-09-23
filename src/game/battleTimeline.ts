export interface BattleCombatantDefinition {
  readonly id: string;
  readonly speed: number;
  readonly isAlive?: boolean;
}

export interface BattleCombatant {
  readonly id: string;
  readonly speed: number;
  readonly nextActionTime: number;
  readonly isAlive: boolean;
  readonly startOrder: number;
}

export interface BattleTimelineState {
  readonly logicalTime: number;
  readonly currentActorId: string | null;
  readonly combatants: readonly BattleCombatant[];
}

export interface UpcomingAction {
  readonly id: string;
  readonly time: number;
}

const INITIAL_LOGICAL_TIME = 0;
const TICKS_PER_ACTION = 10_000;

function actionInterval(combatant: Pick<BattleCombatant, "speed">): number {
  const interval = Math.max(1, Math.round(TICKS_PER_ACTION / combatant.speed));
  if (!Number.isSafeInteger(interval)) {
    throw new Error("速度から計算した行動間隔が安全な整数tickの範囲外です");
  }
  return interval;
}

function assertValidDefinition(definition: BattleCombatantDefinition, ids: ReadonlySet<string>): void {
  if (definition.id.length === 0) {
    throw new Error("戦闘者のIDは空にできません");
  }
  if (ids.has(definition.id)) {
    throw new Error(`戦闘者のIDが重複しています: ${definition.id}`);
  }
  if (!Number.isFinite(definition.speed) || definition.speed <= 0) {
    throw new Error(`戦闘者の速度は正の有限値で指定してください: ${definition.id}`);
  }
}

function findCombatant(state: BattleTimelineState, id: string | null): BattleCombatant | undefined {
  return id === null ? undefined : state.combatants.find((combatant) => combatant.id === id);
}

function findEarliestLivingCombatant(state: BattleTimelineState): BattleCombatant | undefined {
  let earliest: BattleCombatant | undefined;

  for (const combatant of state.combatants) {
    if (!combatant.isAlive) {
      continue;
    }

    if (
      earliest === undefined ||
      combatant.nextActionTime < earliest.nextActionTime ||
      (combatant.nextActionTime === earliest.nextActionTime && combatant.startOrder < earliest.startOrder)
    ) {
      earliest = combatant;
    }
  }

  return earliest;
}

export function createBattleTimeline(definitions: readonly BattleCombatantDefinition[]): BattleTimelineState {
  const ids = new Set<string>();
  const combatants = definitions.map((definition, startOrder) => {
    assertValidDefinition(definition, ids);
    ids.add(definition.id);

    const interval = actionInterval(definition);
    return {
      id: definition.id,
      speed: definition.speed,
      nextActionTime: interval,
      isAlive: definition.isAlive ?? true,
      startOrder,
    } satisfies BattleCombatant;
  });

  return {
    logicalTime: INITIAL_LOGICAL_TIME,
    currentActorId: null,
    combatants,
  };
}

export function advanceToNextActor(state: BattleTimelineState): BattleTimelineState {
  const currentActor = findCombatant(state, state.currentActorId);
  if (currentActor?.isAlive === true) {
    return state;
  }

  const nextActor = findEarliestLivingCombatant(state);
  if (nextActor === undefined) {
    return state.currentActorId === null ? state : { ...state, currentActorId: null };
  }

  return {
    ...state,
    logicalTime: nextActor.nextActionTime,
    currentActorId: nextActor.id,
  };
}

export function completeCurrentAction(state: BattleTimelineState): BattleTimelineState {
  const currentActor = findCombatant(state, state.currentActorId);
  if (currentActor === undefined) {
    return state;
  }
  if (!currentActor.isAlive) {
    return { ...state, currentActorId: null };
  }

  const nextActionTime = state.logicalTime + actionInterval(currentActor);
  if (!Number.isSafeInteger(nextActionTime)) {
    throw new Error("次の行動時刻が安全な整数tickの範囲外です");
  }
  return {
    ...state,
    currentActorId: null,
    combatants: state.combatants.map((combatant) =>
      combatant.id === currentActor.id ? { ...combatant, nextActionTime } : combatant,
    ),
  };
}

export function setCombatantAlive(state: BattleTimelineState, id: string, isAlive: boolean): BattleTimelineState {
  const combatant = state.combatants.find((candidate) => candidate.id === id);
  if (combatant === undefined) {
    throw new Error(`存在しない戦闘者です: ${id}`);
  }
  if (combatant.isAlive === isAlive) {
    return state;
  }

  return {
    ...state,
    currentActorId: state.currentActorId === id && !isAlive ? null : state.currentActorId,
    combatants: state.combatants.map((candidate) => (candidate.id === id ? { ...candidate, isAlive } : candidate)),
  };
}

export function getUpcomingActions(state: BattleTimelineState, count: number): UpcomingAction[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("予測する行動数は0以上の整数で指定してください");
  }

  const actions: UpcomingAction[] = [];
  let predictedState = state;

  while (actions.length < count) {
    predictedState = advanceToNextActor(predictedState);
    const currentActor = findCombatant(predictedState, predictedState.currentActorId);
    if (currentActor === undefined || !currentActor.isAlive) {
      break;
    }

    actions.push({
      id: currentActor.id,
      time: predictedState.logicalTime,
    });
    predictedState = completeCurrentAction(predictedState);
  }

  return actions;
}
