import { loadSymptomDefinition } from "../content/loadSymptomDefinition";
import {
  advanceToNextActor,
  type BattleTimelineState,
  completeCurrentAction,
  createBattleTimeline,
  getUpcomingActions,
  type UpcomingAction,
} from "./battleTimeline";
import { createGameRandom, nextGameRandom } from "./gameRandom";
import { applyAdditionalLoadSymptom, type LoadSymptomApplication } from "./loadSymptoms";
import { type MentalFatigueDefinition, mentalFatigueMultiplier, validateMentalFatigue } from "./mentalFatigue";
import {
  activeSkillBaseAmount,
  type LearnedSkill,
  mentalFatigueAffectedQuantity,
  type SkillCatalog,
  skillById,
} from "./skills";
import {
  applyIncapacity,
  type CharacterStatus,
  canParticipate,
  effectiveHitRate,
  effectiveMaxHp,
  healthyStatus,
  validateCharacterStatus,
} from "./status";

export interface BattleSkillRules {
  readonly growth?: import("./growthRuntime").GrowthRules;
  readonly catalog: SkillCatalog;
  readonly fatigue: MentalFatigueDefinition;
}

export type BattleTeam = "ally" | "enemy";

export type BattleOutcome = "ongoing" | "victory" | "defeat";

/**
 * 戦闘開始時に固定する試作用の戦闘者データ。
 * 最大HP・命中率を省略した既存定義も受け付ける。
 */
export interface BattleCombatantDefinition {
  readonly mentalFatigue?: number;
  readonly learnedSkills?: readonly LearnedSkill[];
  readonly maxHp?: number;
  readonly hitRate?: number;
  readonly status?: CharacterStatus;
  readonly id: string;
  readonly team: BattleTeam;
  readonly speed: number;
  readonly hp: number;
  readonly attackPower: number;
  readonly basicAttackBonus?: number;
}

export interface BattleCombatant {
  readonly mentalFatigue: number;
  readonly learnedSkills: readonly LearnedSkill[];
  readonly maxHp: number;
  readonly hitRate: number;
  readonly status: CharacterStatus;
  readonly id: string;
  readonly team: BattleTeam;
  readonly speed: number;
  readonly nextActionTime: number;
  readonly isAlive: boolean;
  readonly startOrder: number;
  readonly hp: number;
  readonly attackPower: number;
  readonly basicAttackBonus?: number;
}

export interface BattleState extends Omit<BattleTimelineState, "combatants"> {
  readonly combatants: readonly BattleCombatant[];
  readonly outcome: BattleOutcome;
  readonly randomState: number;
}

export type BattleEvent =
  | ({ readonly type: "symptom"; readonly actorId: string } & LoadSymptomApplication)
  | {
      readonly type: "skill";
      readonly actorId: string;
      readonly targetId: string;
      readonly skillId: string;
      readonly effect: "damage" | "hp-recovery";
      readonly amount: number;
      readonly fatigueBefore: number;
      readonly fatigueAfter: number;
      readonly hit: boolean;
    }
  | { readonly type: "miss"; readonly actorId: string; readonly targetId: string }
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
  | "target-is-defeated"
  | "action-not-current"
  | "skill-not-learned"
  | "skill-not-usable"
  | "numeric-overflow";

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

function assertValidDefinition(definition: BattleCombatantDefinition): void {
  validateMentalFatigue(definition.mentalFatigue ?? 0);
  if (definition.status) validateCharacterStatus(definition.status);
  if (
    definition.hitRate !== undefined &&
    (!Number.isFinite(definition.hitRate) || definition.hitRate < 0 || definition.hitRate > 1)
  )
    throw new Error(`命中率が不正です: ${definition.id}`);
  if (definition.maxHp !== undefined && (!Number.isFinite(definition.maxHp) || definition.maxHp <= 0))
    throw new Error(`最大HPが不正です: ${definition.id}`);
  if (!isBattleTeam(definition.team)) {
    throw new Error(`戦闘者の陣営が不正です: ${definition.id}`);
  }
  if (!Number.isFinite(definition.hp) || definition.hp < 0) {
    throw new Error(`戦闘者のHPは0以上の有限値で指定してください: ${definition.id}`);
  }
  if (
    !Number.isFinite(definition.basicAttackBonus ?? 0) ||
    (definition.basicAttackBonus ?? 0) < 0 ||
    !Number.isFinite(definition.attackPower + (definition.basicAttackBonus ?? 0))
  )
    throw new Error(`通常攻撃力補正が不正です: ${definition.id}`);
  if (!Number.isFinite(definition.attackPower) || definition.attackPower < 0) {
    throw new Error(`戦闘者の攻撃力は0以上の有限値で指定してください: ${definition.id}`);
  }
}

function findCombatant(state: BattleState, id: string): BattleCombatant | undefined {
  return state.combatants.find((combatant) => combatant.id === id);
}

function findFirstLivingCombatant(state: BattleState, team: BattleTeam): BattleCombatant | undefined {
  return state.combatants.find((combatant) => combatant.team === team && combatant.isAlive);
}

function determineOutcome(state: Pick<BattleState, "combatants">): BattleOutcome {
  const alliesAlive = state.combatants.some((combatant) => combatant.team === "ally" && combatant.isAlive);
  const enemiesAlive = state.combatants.some((combatant) => combatant.team === "enemy" && combatant.isAlive);

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

function withTimelineState(state: BattleState, timelineState: BattleTimelineState): BattleState {
  const combatants = timelineState.combatants.map((timelineCombatant) => {
    const combatant = state.combatants.find((candidate) => candidate.id === timelineCombatant.id);
    if (combatant === undefined) {
      throw new Error(`行動順に存在しない戦闘者です: ${timelineCombatant.id}`);
    }
    return {
      ...combatant,
      ...timelineCombatant,
    } satisfies BattleCombatant;
  });

  return {
    ...state,
    ...timelineState,
    combatants,
    outcome: state.outcome,
  };
}

export function createBattleState(
  definitions: readonly BattleCombatantDefinition[],
  randomState = createGameRandom(),
): BattleState {
  if (!definitions.some((definition) => definition.team === "ally")) {
    throw new Error("味方の戦闘者が必要です");
  }
  if (!definitions.some((definition) => definition.team === "enemy")) {
    throw new Error("敵の戦闘者が必要です");
  }

  definitions.forEach(assertValidDefinition);
  const normalized = definitions.map((definition) => {
    const status =
      definition.hp === 0 && definition.status === undefined
        ? applyIncapacity(healthyStatus())
        : (definition.status ?? healthyStatus());
    const maxHp = definition.maxHp ?? Math.max(1, definition.hp);
    return {
      ...definition,
      status,
      maxHp,
      hitRate: effectiveHitRate(definition.hitRate, healthyStatus()),
      hp: Math.min(definition.hp, effectiveMaxHp(maxHp, status)),
    };
  });
  const timeline = createBattleTimeline(
    normalized.map((definition) => ({
      id: definition.id,
      speed: definition.speed,
      isAlive: canParticipate(definition.hp, definition.status),
    })),
  );
  const combatants = timeline.combatants.map((combatant, index) => {
    const definition = normalized[index];
    return {
      ...combatant,
      mentalFatigue: definition.mentalFatigue ?? 0,
      learnedSkills: definition.learnedSkills ?? [],
      status: definition.status,
      maxHp: definition.maxHp,
      hitRate: definition.hitRate,
      team: definition.team,
      hp: definition.hp,
      attackPower: definition.attackPower,
      basicAttackBonus: definition.basicAttackBonus ?? 0,
    } satisfies BattleCombatant;
  });

  const stateWithoutOutcome = {
    randomState: createGameRandom(randomState),
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
export function getBattleUpcomingActions(state: BattleState, count: number): UpcomingAction[] {
  if (state.outcome !== "ongoing") {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError("予測する行動数は0以上の整数で指定してください");
    }
    return [];
  }
  return getUpcomingActions(state, count);
}

function reject(state: BattleState, reason: BasicAttackRejectionReason): BasicAttackRejected {
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
export function performBasicAttack(state: BattleState, actorId: string, targetId: string): BasicAttackResult {
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
    throw new Error(`戦闘不能の戦闘者が行動待ちになっています: ${state.currentActorId}`);
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

  const hitRate = effectiveHitRate(actor.hitRate, actor.status);
  const basicPower = actor.attackPower + (actor.basicAttackBonus ?? 0);
  const draw = basicPower > 0 && hitRate > 0 && hitRate < 1 ? nextGameRandom(state.randomState) : null;
  const hit = hitRate === 1 || (hitRate > 0 && (draw === null || draw.value < hitRate));
  const targetHpBefore = target.hp;
  const targetHpAfter = Math.max(0, targetHpBefore - (hit ? basicPower : 0));
  const targetWasDefeated = targetHpAfter === 0;
  const combatants = state.combatants.map((combatant) =>
    combatant.id === target.id
      ? {
          ...combatant,
          hp: targetHpAfter,
          status: targetWasDefeated ? applyIncapacity(combatant.status) : combatant.status,
          isAlive: !targetWasDefeated,
        }
      : combatant,
  );
  const stateAfterDamage = {
    ...state,
    randomState: draw?.state ?? state.randomState,
    combatants,
  } satisfies BattleState;
  const outcome = determineOutcome(stateAfterDamage);
  const events: BattleEvent[] = hit
    ? [
        {
          type: "attack",
          actorId,
          targetId,
          damage: basicPower,
          targetHpBefore,
          targetHpAfter,
        },
      ]
    : [{ type: "miss", actorId, targetId }];

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

  return completeBattleAction({ ...stateAfterDamage, outcome }, events);
}

function completeBattleAction(state: BattleState, events: BattleEvent[]): BasicAttackSuccess {
  const completed = withTimelineState(state, completeCurrentAction(state));
  return {
    accepted: true,
    state: state.outcome === "ongoing" ? advanceBattleToNextActor(completed) : completed,
    events,
  };
}

/** Atomic effect -> fatigue -> symptoms, then timeline.
 * The expected logical time rejects retries from the previous input turn.
 */
export function performBattleSkill(
  state: BattleState,
  actorId: string,
  targetId: string,
  skillId: string,
  expectedActionTime: number,
  catalog: SkillCatalog,
  fatigue: MentalFatigueDefinition,
): BasicAttackResult {
  if (state.outcome !== "ongoing") return reject(state, "battle-ended");
  if (state.logicalTime !== expectedActionTime) return reject(state, "action-not-current");
  if (state.currentActorId !== actorId) return reject(state, "actor-is-not-current");
  const actor = findCombatant(state, actorId);
  if (!actor || !canParticipate(actor.hp, actor.status)) return reject(state, "no-current-actor");
  if (!actor.learnedSkills.some((known) => known.skillId === skillId && known.type === "active"))
    return reject(state, "skill-not-learned");
  const skill = skillById(catalog, skillId);
  if (skill.type !== "active" || !skill.scenes.includes("battle")) return reject(state, "skill-not-usable");
  const target = findCombatant(state, targetId);
  if (!target) return reject(state, "target-does-not-exist");
  if (!canParticipate(target.hp, target.status)) return reject(state, "target-is-defeated");
  if ((skill.target === "single-enemy") === (target.team === actor.team)) return reject(state, "skill-not-usable");
  const fatigueAfter = actor.mentalFatigue + skill.mentalFatigueIncrease;
  if (!Number.isFinite(fatigueAfter)) return reject(state, "numeric-overflow");
  const base = activeSkillBaseAmount(skill, {
    attackPower: actor.attackPower,
    maxHp: effectiveMaxHp(actor.maxHp, actor.status),
  });
  const amount =
    base * (mentalFatigueAffectedQuantity(skill) ? mentalFatigueMultiplier(actor.mentalFatigue, fatigue) : 1);
  const hitRate = skill.effect.type === "damage" ? effectiveHitRate(actor.hitRate, actor.status) : 1;
  const draw = amount > 0 && hitRate > 0 && hitRate < 1 ? nextGameRandom(state.randomState) : null;
  const hit = hitRate === 1 || (hitRate > 0 && (draw === null || draw.value < hitRate));
  const applied = hit ? amount : 0;
  const hp =
    skill.effect.type === "damage"
      ? Math.max(0, target.hp - applied)
      : Math.min(effectiveMaxHp(target.maxHp, target.status), target.hp + applied);
  const defeated = hp === 0;
  const combatants = state.combatants.map((entry) => ({
    ...entry,
    ...(entry.id === targetId
      ? { hp, isAlive: !defeated, status: defeated ? applyIncapacity(entry.status) : entry.status }
      : {}),
    ...(entry.id === actorId ? { mentalFatigue: fatigueAfter } : {}),
  }));
  const user = combatants.find((entry) => entry.id === actorId);
  if (!user) throw new Error("スキル使用者がありません");
  const onset = applyAdditionalLoadSymptom(
    user.status,
    fatigueAfter,
    skill.mentalFatigueIncrease,
    draw?.state ?? state.randomState,
    loadSymptomDefinition,
  );
  const resolvedCombatants = combatants.map((entry) => {
    if (entry.id !== actorId || onset.application === null) return entry;
    const status = { ...entry.status, ...onset.symptoms };
    return { ...entry, status, hp: Math.min(entry.hp, effectiveMaxHp(entry.maxHp, status)) };
  });
  const outcome = determineOutcome({ combatants: resolvedCombatants });
  const events: BattleEvent[] = [
    {
      type: "skill",
      actorId,
      targetId,
      skillId,
      effect: skill.effect.type,
      amount: Math.abs(hp - target.hp),
      fatigueBefore: actor.mentalFatigue,
      fatigueAfter,
      hit,
    },
  ];
  if (onset.application) events.push({ type: "symptom", actorId, ...onset.application });
  if (defeated) events.push({ type: "combatant-defeated", combatantId: targetId });
  if (outcome !== "ongoing") events.push({ type: "battle-ended", outcome });
  return completeBattleAction(
    { ...state, randomState: onset.randomState, combatants: resolvedCombatants, outcome },
    events,
  );
}
export function performBattleSkillAndAdvanceToAllyInput(
  state: BattleState,
  actorId: string,
  targetId: string,
  skillId: string,
  expectedActionTime: number,
  catalog: SkillCatalog,
  fatigue: MentalFatigueDefinition,
): BasicAttackResult {
  const used = performBattleSkill(state, actorId, targetId, skillId, expectedActionTime, catalog, fatigue);
  if (!used.accepted || state.combatants.find((entry) => entry.id === actorId)?.team !== "ally") return used;
  const loop = advanceBattleToNextAllyInput(used.state);
  return { accepted: true, state: loop.state, events: [...used.events, ...loop.events] };
}

/**
 * 開始時または味方の行動後に、次の味方入力待ちまで敵行動を同期的に解決する。
 * 敵は戦闘開始時の配列順で、最初に生存している味方を通常攻撃する。
 */
export function advanceBattleToNextAllyInput(state: BattleState): BattleLoopResult {
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
  if (!attack.accepted || state.combatants.find((candidate) => candidate.id === actorId)?.team !== "ally") {
    return attack;
  }
  const loop = advanceBattleToNextAllyInput(attack.state);
  return {
    accepted: true,
    state: loop.state,
    events: [...attack.events, ...loop.events],
  };
}
