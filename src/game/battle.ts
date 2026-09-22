import {
  advanceToNextActor,
  completeCurrentAction,
  createBattleTimeline,
  getUpcomingActions,
  type BattleTimelineState,
  type UpcomingAction,
} from "./battleTimeline";

export type BattleTeam = "ally" | "enemy";

export type BattleOutcome = "ongoing" | "victory" | "defeat";

/**
 * 戦闘開始時に固定する試作用の戦闘者データ。
 * 命中率・防御力など、今回の戦闘で使わない数値は持たせない。
 */
export interface BattleCombatantDefinition {
  readonly id: string;
  readonly team: BattleTeam;
  readonly speed: number;
  readonly hp: number;
  readonly attackPower: number;
}

export interface BattleCombatant {
  readonly id: string;
  readonly team: BattleTeam;
  readonly speed: number;
  readonly nextActionTime: number;
  readonly isAlive: boolean;
  readonly startOrder: number;
  readonly hp: number;
  readonly attackPower: number;
}

export interface BattleState extends Omit<BattleTimelineState, "combatants"> {
  readonly combatants: readonly BattleCombatant[];
  readonly outcome: BattleOutcome;
}

export type BattleEvent =
  | {
      readonly type: "attack";
      readonly actorId: string;
      readonly targetId: string;
      readonly damage: number;
      readonly targetHpBefore: number;
      readonly targetHpAfter: number;
    }
  | {
      readonly type: "combatant-defeated";
      readonly combatantId: string;
    }
  | {
      readonly type: "battle-ended";
      readonly outcome: Exclude<BattleOutcome, "ongoing">;
    };

export type BasicAttackRejectionReason =
  | "battle-ended"
  | "no-current-actor"
  | "actor-is-not-current"
  | "target-does-not-exist"
  | "target-is-ally"
  | "target-is-defeated";

export interface BasicAttackSuccess {
  readonly accepted: true;
  readonly state: BattleState;
  readonly events: BattleEvent[];
}

export interface BasicAttackRejected {
  readonly accepted: false;
  readonly reason: BasicAttackRejectionReason;
  readonly state: BattleState;
  readonly events: BattleEvent[];
}

export type BasicAttackResult = BasicAttackSuccess | BasicAttackRejected;

export interface BattleLoopResult {
  readonly state: BattleState;
  readonly events: BattleEvent[];
}

const BATTLE_TEAMS: readonly BattleTeam[] = ["ally", "enemy"];

function isBattleTeam(value: unknown): value is BattleTeam {
  return BATTLE_TEAMS.includes(value as BattleTeam);
}

function assertValidDefinition(
  definition: BattleCombatantDefinition,
): void {
  if (!isBattleTeam(definition.team)) {
    throw new Error(`戦闘者の陣営が不正です: ${definition.id}`);
  }
  if (!Number.isFinite(definition.hp) || definition.hp < 0) {
    throw new Error(`戦闘者のHPは0以上の有限値で指定してください: ${definition.id}`);
  }
  if (
    !Number.isFinite(definition.attackPower) ||
    definition.attackPower < 0
  ) {
    throw new Error(
      `戦闘者の攻撃力は0以上の有限値で指定してください: ${definition.id}`,
    );
  }
}

function findCombatant(
  state: BattleState,
  id: string,
): BattleCombatant | undefined {
  return state.combatants.find((combatant) => combatant.id === id);
}

function findFirstLivingCombatant(
  state: BattleState,
  team: BattleTeam,
): BattleCombatant | undefined {
  return state.combatants.find(
    (combatant) => combatant.team === team && combatant.isAlive,
  );
}

function determineOutcome(state: Pick<BattleState, "combatants">): BattleOutcome {
  const alliesAlive = state.combatants.some(
    (combatant) => combatant.team === "ally" && combatant.isAlive,
  );
  const enemiesAlive = state.combatants.some(
    (combatant) => combatant.team === "enemy" && combatant.isAlive,
  );

  if (!enemiesAlive && alliesAlive) {
    return "victory";
  }
  if (!alliesAlive && enemiesAlive) {
    return "defeat";
  }
  if (!alliesAlive && !enemiesAlive) {
    throw new Error("味方と敵が同時に全滅した戦闘状態です");
  }
  return "ongoing";
}

function withTimelineState(
  state: BattleState,
  timelineState: BattleTimelineState,
): BattleState {
  const combatants = timelineState.combatants.map((timelineCombatant) => {
    const combatant = state.combatants.find(
      (candidate) => candidate.id === timelineCombatant.id,
    );
    if (combatant === undefined) {
      throw new Error(`行動順に存在しない戦闘者です: ${timelineCombatant.id}`);
    }
    return {
      ...combatant,
      ...timelineCombatant,
    } satisfies BattleCombatant;
  });

  return {
    ...timelineState,
    combatants,
    outcome: state.outcome,
  };
}

export function createBattleState(
  definitions: readonly BattleCombatantDefinition[],
): BattleState {
  if (!definitions.some((definition) => definition.team === "ally")) {
    throw new Error("味方の戦闘者が必要です");
  }
  if (!definitions.some((definition) => definition.team === "enemy")) {
    throw new Error("敵の戦闘者が必要です");
  }

  definitions.forEach(assertValidDefinition);
  const timeline = createBattleTimeline(
    definitions.map((definition) => ({
      id: definition.id,
      speed: definition.speed,
      isAlive: definition.hp > 0,
    })),
  );
  const combatants = timeline.combatants.map((combatant, index) => {
    const definition = definitions[index];
    return {
      ...combatant,
      team: definition.team,
      hp: definition.hp,
      attackPower: definition.attackPower,
    } satisfies BattleCombatant;
  });

  const stateWithoutOutcome = {
    ...timeline,
    combatants,
  } satisfies Omit<BattleState, "outcome">;
  const outcome = determineOutcome(stateWithoutOutcome);

  return {
    ...stateWithoutOutcome,
    outcome,
  };
}

/** 入力待ちの行動者を選ぶ。終了後は状態を進めない。 */
export function advanceBattleToNextActor(state: BattleState): BattleState {
  if (state.outcome !== "ongoing") {
    return state;
  }

  return withTimelineState(state, advanceToNextActor(state));
}

/** 戦闘状態の現在の行動者を確定し、行動順を予測する。 */
export function getBattleUpcomingActions(
  state: BattleState,
  count: number,
): UpcomingAction[] {
  if (state.outcome !== "ongoing") {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError("予測する行動数は0以上の整数で指定してください");
    }
    return [];
  }
  return getUpcomingActions(state, count);
}

function reject(
  state: BattleState,
  reason: BasicAttackRejectionReason,
): BasicAttackRejected {
  return {
    accepted: false,
    reason,
    state,
    events: [],
  };
}

/**
 * 現在の行動者が指定した敵へ通常攻撃する。
 * 攻撃、HP更新、戦闘不能、勝敗判定はこの同期処理で確定する。
 */
export function performBasicAttack(
  state: BattleState,
  actorId: string,
  targetId: string,
): BasicAttackResult {
  if (state.outcome !== "ongoing") {
    return reject(state, "battle-ended");
  }
  if (state.currentActorId === null) {
    return reject(state, "no-current-actor");
  }

  const currentActor = findCombatant(state, state.currentActorId);
  if (currentActor === undefined) {
    throw new Error(`現在の行動者が存在しません: ${state.currentActorId}`);
  }
  if (!currentActor.isAlive) {
    throw new Error(
      `戦闘不能の戦闘者が行動待ちになっています: ${state.currentActorId}`,
    );
  }
  if (state.currentActorId !== actorId) {
    return reject(state, "actor-is-not-current");
  }
  const actor = currentActor;

  const target = findCombatant(state, targetId);
  if (target === undefined) {
    return reject(state, "target-does-not-exist");
  }
  if (target.team === actor.team) {
    return reject(state, "target-is-ally");
  }
  if (!target.isAlive) {
    return reject(state, "target-is-defeated");
  }

  const targetHpBefore = target.hp;
  const targetHpAfter = Math.max(0, targetHpBefore - actor.attackPower);
  const targetWasDefeated = targetHpAfter === 0;
  const combatants = state.combatants.map((combatant) =>
    combatant.id === target.id
      ? {
          ...combatant,
          hp: targetHpAfter,
          isAlive: !targetWasDefeated,
        }
      : combatant,
  );
  const stateAfterDamage = {
    ...state,
    combatants,
  } satisfies BattleState;
  const outcome = determineOutcome(stateAfterDamage);
  const events: BattleEvent[] = [
    {
      type: "attack",
      actorId,
      targetId,
      damage: actor.attackPower,
      targetHpBefore,
      targetHpAfter,
    },
  ];

  if (targetWasDefeated) {
    events.push({
      type: "combatant-defeated",
      combatantId: target.id,
    });
  }
  if (outcome !== "ongoing") {
    events.push({
      type: "battle-ended",
      outcome,
    });
  }

  const withOutcome = {
    ...stateAfterDamage,
    outcome,
  } satisfies BattleState;
  const completed = withTimelineState(
    withOutcome,
    completeCurrentAction(withOutcome),
  );
  const nextState =
    outcome === "ongoing"
      ? advanceBattleToNextActor(completed)
      : completed;

  return {
    accepted: true,
    state: nextState,
    events,
  };
}

/**
 * 開始時または味方の行動後に、次の味方入力待ちまで敵行動を同期的に解決する。
 * 敵は戦闘開始時の配列順で、最初に生存している味方を通常攻撃する。
 */
export function advanceBattleToNextAllyInput(
  state: BattleState,
): BattleLoopResult {
  if (state.outcome !== "ongoing") {
    return { state, events: [] };
  }

  let current = state;
  const events: BattleEvent[] = [];
  if (current.currentActorId === null) {
    current = advanceBattleToNextActor(current);
  }

  while (current.outcome === "ongoing") {
    if (current.currentActorId === null) {
      current = advanceBattleToNextActor(current);
    }
    const actorId = current.currentActorId;
    if (actorId === null) {
      throw new Error("継続中の戦闘に次の行動者が存在しません");
    }
    const actor = findCombatant(current, actorId);
    if (actor === undefined) {
      throw new Error(`現在の行動者が存在しません: ${actorId}`);
    }
    if (actor.team === "ally") return { state: current, events };

    const target = findFirstLivingCombatant(current, "ally");
    if (target === undefined) {
      throw new Error("敵行動の対象となる生存した味方が存在しません");
    }
    const result = performBasicAttack(current, actor.id, target.id);
    if (!result.accepted) {
      throw new Error(`敵の通常攻撃を実行できません: ${result.reason}`);
    }
    events.push(...result.events);
    current = result.state;
  }

  return { state: current, events };
}

/** 味方の行動と、その直後に必要な敵行動を一度に解決する補助関数。 */
export function performBasicAttackAndAdvanceToAllyInput(
  state: BattleState,
  actorId: string,
  targetId: string,
): BasicAttackResult {
  const attack = performBasicAttack(state, actorId, targetId);
  if (!attack.accepted || state.combatants.find(candidate => candidate.id === actorId)?.team !== "ally") {
    return attack;
  }
  const loop = advanceBattleToNextAllyInput(attack.state);
  return {
    accepted: true,
    state: loop.state,
    events: [...attack.events, ...loop.events],
  };
}
