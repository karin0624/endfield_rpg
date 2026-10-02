import type {
  AdventureActionResult,
  AdventureDefinition,
  AdventureRejectionReason,
  ConversationScene,
} from "./adventure";
import {
  advanceConversation,
  assertValidAdventureDefinition,
  chooseConversationOption,
  getCurrentConversationScene,
} from "./adventure";
import {
  advanceBattleToNextAllyInput,
  type BasicAttackRejectionReason,
  type BasicAttackResult,
  type BattleCombatantDefinition,
  type BattleEvent,
  type BattleOutcome,
  type BattleSkillRules,
  type BattleState,
  createBattleState,
  performBasicAttackAndAdvanceToAllyInput,
  performBattleSkillAndAdvanceToAllyInput,
} from "./battle";
import type { GameState } from "./createInitialGameState";

interface DungeonNodeBase {
  readonly id: string;
  readonly label: string;
  readonly nextNodeIds: readonly string[];
}

export interface DungeonStartNodeDefinition extends DungeonNodeBase {
  readonly type: "start";
}

export interface DungeonBattleNodeDefinition extends DungeonNodeBase {
  readonly type: "battle";
  readonly enemies: readonly BattleCombatantDefinition[];
}

export interface DungeonBossNodeDefinition extends DungeonNodeBase {
  readonly type: "boss";
  readonly enemies: readonly BattleCombatantDefinition[];
}

export interface DungeonConversationNodeDefinition extends DungeonNodeBase {
  readonly type: "conversation";
  readonly conversationId: string;
}

export type DungeonNodeDefinition =
  | DungeonStartNodeDefinition
  | DungeonBattleNodeDefinition
  | DungeonBossNodeDefinition
  | DungeonConversationNodeDefinition;

export interface DungeonDefinition {
  readonly id: string;
  readonly entryNodeId: string;
  readonly nodes: readonly DungeonNodeDefinition[];
}

export type DungeonOutcome = "ongoing" | "cleared" | "failed";

export type DungeonActivity =
  | { readonly type: "battle"; readonly state: BattleState }
  | { readonly type: "conversation"; readonly state: GameState };

export interface DungeonState {
  readonly expeditionActionId?: number;
  readonly dungeonId: string;
  /** The last entered node, or the entry node before the first choice. */
  readonly currentNodeId: string;
  /** The node whose battle or conversation is still in progress. */
  readonly activeNodeId: string | null;
  readonly resolvedNodeIds: readonly string[];
  readonly outcome: DungeonOutcome;
  readonly activity: DungeonActivity | null;
  /** Ally definitions with their current HP, carried between battles. */
  readonly party: readonly BattleCombatantDefinition[];
  readonly randomState: number;
  readonly flags: readonly string[];
}

export interface DungeonNodeOption {
  readonly id: string;
  readonly label: string;
  readonly type: Exclude<DungeonNodeDefinition["type"], "start">;
}

export type DungeonRejectionReason =
  | "pending-growth-choice"
  | "wrong-dungeon"
  | "dungeon-ended"
  | "node-in-progress"
  | "current-node-unresolved"
  | "node-already-resolved"
  | "node-not-connected"
  | "not-in-battle"
  | "not-in-conversation"
  | `battle:${BasicAttackRejectionReason}`
  | `adventure:${AdventureRejectionReason}`;

export type DungeonActionResult =
  | {
      readonly accepted: true;
      readonly state: DungeonState;
      readonly events: BattleEvent[];
      /** Final battle state for the screen result after the activity returns to the route. */
      readonly battleState?: BattleState;
    }
  | {
      readonly accepted: false;
      readonly reason: DungeonRejectionReason;
      readonly state: DungeonState;
      readonly events: BattleEvent[];
    };

function assertNonEmpty(value: string, context: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${context}は空にできません`);
  }
}

function getNode(definition: DungeonDefinition, nodeId: string): DungeonNodeDefinition | undefined {
  return definition.nodes.find((node) => node.id === nodeId);
}

function assertAcyclicAndReachable(definition: DungeonDefinition): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): void {
    if (visiting.has(nodeId)) {
      throw new Error(`ダンジョンルートに循環があります: ${nodeId}`);
    }
    if (visited.has(nodeId)) {
      return;
    }
    visiting.add(nodeId);
    const node = getNode(definition, nodeId);
    if (node === undefined) {
      throw new Error(`接続先ノードが存在しません: ${nodeId}`);
    }
    for (const nextNodeId of node.nextNodeIds) {
      visit(nextNodeId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  visit(definition.entryNodeId);
  if (visited.size !== definition.nodes.length) {
    const unreachable = definition.nodes.find((node) => !visited.has(node.id));
    throw new Error(`入口から到達できないノードがあります: ${unreachable?.id ?? "unknown"}`);
  }
}

/** Validate the fixed, single-floor graph and all combat and conversation references. */
export function assertValidDungeonDefinition(
  definition: DungeonDefinition,
  adventure: AdventureDefinition,
  party: readonly BattleCombatantDefinition[],
): void {
  assertNonEmpty(definition.id, "ダンジョンID");
  assertNonEmpty(definition.entryNodeId, `ダンジョン${definition.id}の入口ノードID`);
  if (definition.nodes.length === 0) {
    throw new Error(`ダンジョンにノードがありません: ${definition.id}`);
  }
  if (party.length === 0 || party.some((member) => member.team !== "ally")) {
    throw new Error(`ダンジョンには味方の編成が必要です: ${definition.id}`);
  }

  const nodeById = new Map<string, DungeonNodeDefinition>();
  for (const node of definition.nodes) {
    assertNonEmpty(node.id, "ダンジョンノードID");
    assertNonEmpty(node.label, `ノード${node.id}の表示名`);
    if (nodeById.has(node.id)) {
      throw new Error(`ダンジョンノードIDが重複しています: ${node.id}`);
    }
    nodeById.set(node.id, node);
    if (new Set(node.nextNodeIds).size !== node.nextNodeIds.length) {
      throw new Error(`接続先ノードIDが重複しています: ${node.id}`);
    }
  }
  for (const node of definition.nodes) {
    for (const nextNodeId of node.nextNodeIds) {
      assertNonEmpty(nextNodeId, `ノード${node.id}の接続先ID`);
      if (!nodeById.has(nextNodeId)) {
        throw new Error(`接続先ノードが存在しません: ${node.id} → ${nextNodeId}`);
      }
      if (nextNodeId === node.id) {
        throw new Error(`ノード自身への接続はできません: ${node.id}`);
      }
    }
  }

  const entry = nodeById.get(definition.entryNodeId);
  if (entry?.type !== "start") {
    throw new Error(`入口ノードはstart型で指定してください: ${definition.entryNodeId}`);
  }
  if (definition.nodes.filter((node) => node.type === "start").length !== 1) {
    throw new Error("start型ノードは入口の1つだけにしてください");
  }

  const incomingNodeIds = new Set(definition.nodes.flatMap((node) => node.nextNodeIds));
  if (incomingNodeIds.has(definition.entryNodeId)) {
    throw new Error(`入口ノードへ戻る接続はできません: ${definition.entryNodeId}`);
  }

  const bossNodes = definition.nodes.filter((node) => node.type === "boss");
  if (bossNodes.length !== 1 || bossNodes[0]?.nextNodeIds.length !== 0) {
    throw new Error("終端となるboss型ノードを1つ指定してください");
  }

  const partyIds = new Set<string>();
  for (const member of party) {
    assertNonEmpty(member.id, "味方ID");
    if (partyIds.has(member.id)) {
      throw new Error(`味方IDが重複しています: ${member.id}`);
    }
    partyIds.add(member.id);
  }

  assertValidAdventureDefinition(adventure);
  for (const node of definition.nodes) {
    if (node.type === "start" && node.nextNodeIds.length === 0) {
      throw new Error(`入口ノードに接続先がありません: ${node.id}`);
    }
    if (node.type === "battle" || node.type === "conversation") {
      if (node.nextNodeIds.length === 0) {
        throw new Error(`終端以外のノードに接続先がありません: ${node.id}`);
      }
    }
    if (node.type === "conversation") {
      assertNonEmpty(node.conversationId, `ノード${node.id}の会話ID`);
      if (!adventure.conversations.some((conversation) => conversation.id === node.conversationId)) {
        throw new Error(`ダンジョンが参照する会話が存在しません: ${node.id}/${node.conversationId}`);
      }
    }
    if (node.type === "battle" || node.type === "boss") {
      if (node.enemies.length === 0 || node.enemies.some((enemy) => enemy.team !== "enemy")) {
        throw new Error(`戦闘ノードには敵だけの編成が必要です: ${node.id}`);
      }
      createBattleState([...party, ...node.enemies]);
    }
  }

  assertAcyclicAndReachable(definition);
}

/** Create a route at its entry. The entry node is already resolved and exposes its links. */
export function createDungeonState(
  definition: DungeonDefinition,
  adventure: AdventureDefinition,
  party: readonly BattleCombatantDefinition[],
  initialFlags: readonly string[] = [],
  randomState = 1,
): DungeonState {
  assertValidDungeonDefinition(definition, adventure, party);
  const entry = getNode(definition, definition.entryNodeId);
  if (entry === undefined || entry.type !== "start") {
    throw new Error(`入口ノードが存在しません: ${definition.entryNodeId}`);
  }
  return {
    randomState,
    dungeonId: definition.id,
    currentNodeId: entry.id,
    activeNodeId: null,
    resolvedNodeIds: [entry.id],
    outcome: "ongoing",
    activity: null,
    party: party.map((member) => ({ ...member })),
    flags: [...new Set(initialFlags)],
  };
}

/** Return only unresolved nodes directly connected to the resolved current node. */
export function getAvailableDungeonNodes(state: DungeonState, definition: DungeonDefinition): DungeonNodeOption[] {
  if (
    state.dungeonId !== definition.id ||
    state.outcome !== "ongoing" ||
    state.activeNodeId !== null ||
    state.activity !== null ||
    !state.resolvedNodeIds.includes(state.currentNodeId)
  ) {
    return [];
  }
  const currentNode = getNode(definition, state.currentNodeId);
  if (currentNode === undefined) {
    return [];
  }
  return currentNode.nextNodeIds.flatMap((nodeId) => {
    const node = getNode(definition, nodeId);
    if (node === undefined || node.type === "start" || state.resolvedNodeIds.includes(node.id)) {
      return [];
    }
    return [{ id: node.id, label: node.label, type: node.type }];
  });
}

function reject(state: DungeonState, reason: DungeonRejectionReason): DungeonActionResult {
  return { accepted: false, reason, state, events: [] };
}

function completeNode(
  state: DungeonState,
  nodeId: string,
  nodeType: DungeonNodeDefinition["type"],
  outcome: Exclude<BattleOutcome, "ongoing"> | "conversation-complete",
): DungeonState {
  const dungeonOutcome: DungeonOutcome =
    outcome === "defeat" ? "failed" : nodeType === "boss" && outcome === "victory" ? "cleared" : "ongoing";
  return {
    ...state,
    currentNodeId: nodeId,
    activeNodeId: null,
    resolvedNodeIds: state.resolvedNodeIds.includes(nodeId)
      ? [...state.resolvedNodeIds]
      : [...state.resolvedNodeIds, nodeId],
    outcome: dungeonOutcome,
    activity: null,
  };
}

function updatePartyFromBattle(state: DungeonState, battle: BattleState): readonly BattleCombatantDefinition[] {
  return state.party.map((member) => {
    const combatant = battle.combatants.find((candidate) => candidate.id === member.id);
    if (combatant === undefined || combatant.team !== "ally") {
      throw new Error(`戦闘に味方が存在しません: ${member.id}`);
    }
    return {
      ...member,
      maxHp: combatant.maxHp,
      hitRate: combatant.hitRate,
      mentalFatigue: combatant.mentalFatigue,
      learnedSkills: combatant.learnedSkills,
      hp: combatant.hp,
      status: combatant.status,
    };
  });
}

function startBattleNode(
  state: DungeonState,
  node: DungeonBattleNodeDefinition | DungeonBossNodeDefinition,
): DungeonActionResult {
  const battle = createBattleState([...state.party, ...node.enemies], state.randomState);
  const loop = advanceBattleToNextAllyInput(battle);
  const started: DungeonState = {
    ...state,
    activeNodeId: node.id,
    randomState: loop.state.randomState,
    activity: { type: "battle", state: loop.state },
    party: updatePartyFromBattle(state, loop.state),
  };
  if (loop.state.outcome === "victory" || loop.state.outcome === "defeat") {
    return {
      accepted: true,
      state: completeNode(started, node.id, node.type, loop.state.outcome),
      events: loop.events,
      battleState: loop.state,
    };
  }
  return { accepted: true, state: started, events: loop.events };
}

/** Enter a directly connected node after the current node has been resolved. */
export function enterNextDungeonNode(
  state: DungeonState,
  nodeId: string,
  definition: DungeonDefinition,
  adventure: AdventureDefinition,
): DungeonActionResult {
  if (state.dungeonId !== definition.id) {
    return reject(state, "wrong-dungeon");
  }
  if (state.outcome !== "ongoing") {
    return reject(state, "dungeon-ended");
  }
  if (state.activeNodeId !== null || state.activity !== null) {
    return reject(state, "node-in-progress");
  }
  if (!state.resolvedNodeIds.includes(state.currentNodeId)) {
    return reject(state, "current-node-unresolved");
  }
  if (state.resolvedNodeIds.includes(nodeId)) {
    return reject(state, "node-already-resolved");
  }
  const currentNode = getNode(definition, state.currentNodeId);
  const node = getNode(definition, nodeId);
  if (currentNode === undefined || node === undefined || !currentNode.nextNodeIds.includes(nodeId)) {
    return reject(state, "node-not-connected");
  }

  if (node.type === "battle" || node.type === "boss") {
    return startBattleNode({ ...state, currentNodeId: node.id }, node);
  }
  if (node.type !== "conversation") {
    return reject(state, "node-not-connected");
  }

  assertValidAdventureDefinition(adventure);
  const conversation = adventure.conversations.find((candidate) => candidate.id === node.conversationId);
  if (conversation === undefined) {
    throw new Error(`ダンジョンが参照する会話が存在しません: ${node.id}/${node.conversationId}`);
  }
  const conversationState: GameState = {
    mode: "conversation",
    currentPlaceId: `dungeon:${definition.id}`,
    conversationId: conversation.id,
    conversationPosition: conversation.startNodeId,
    flags: [...state.flags],
  };
  return {
    accepted: true,
    state: {
      ...state,
      currentNodeId: node.id,
      activeNodeId: node.id,
      activity: { type: "conversation", state: conversationState },
    },
    events: [],
  };
}

/** Read the current dungeon conversation using the shared adventure scene projection. */
export function getCurrentDungeonConversationScene(
  state: DungeonState,
  adventure: AdventureDefinition,
): ConversationScene | null {
  if (state.activity?.type !== "conversation") {
    return null;
  }
  return getCurrentConversationScene(state.activity.state, adventure);
}

function applyConversationResult(state: DungeonState, result: AdventureActionResult): DungeonActionResult {
  if (!result.accepted) {
    return reject(state, `adventure:${result.reason}`);
  }
  if (state.activity?.type !== "conversation" || state.activeNodeId === null) {
    throw new Error("進行中のダンジョン会話がありません");
  }
  const updated: DungeonState = {
    ...state,
    flags: [...result.state.flags],
    activity: { type: "conversation", state: result.state },
  };
  if (result.state.mode === "town") {
    return {
      accepted: true,
      state: completeNode(updated, state.activeNodeId, "conversation", "conversation-complete"),
      events: [],
    };
  }
  return { accepted: true, state: updated, events: [] };
}

/** Advance a dungeon conversation; its completion resolves the node and restores route selection. */
export function advanceDungeonConversation(state: DungeonState, adventure: AdventureDefinition): DungeonActionResult {
  if (state.activity?.type !== "conversation") {
    return reject(state, "not-in-conversation");
  }
  return applyConversationResult(state, advanceConversation(state.activity.state, adventure));
}

/** Choose an option through the shared adventure rules, then resolve the node if the scene ends. */
export function chooseDungeonConversationOption(
  state: DungeonState,
  optionId: string,
  adventure: AdventureDefinition,
): DungeonActionResult {
  if (state.activity?.type !== "conversation") {
    return reject(state, "not-in-conversation");
  }
  return applyConversationResult(state, chooseConversationOption(state.activity.state, optionId, adventure));
}

/** Resolve a player attack and any following enemy actions with the shared battle rules. */
function resolveDungeonBattleAction(
  state: DungeonState,
  definition: DungeonDefinition,
  act: (battle: BattleState) => BasicAttackResult,
): DungeonActionResult {
  if (state.dungeonId !== definition.id) {
    return reject(state, "wrong-dungeon");
  }
  if (state.activity?.type !== "battle" || state.activeNodeId === null) {
    return reject(state, "not-in-battle");
  }
  const node = getNode(definition, state.activeNodeId);
  if (node === undefined || (node.type !== "battle" && node.type !== "boss")) {
    throw new Error(`進行中の戦闘ノードが存在しません: ${state.activeNodeId}`);
  }
  const attack = act(state.activity.state);
  if (!attack.accepted) {
    return reject(state, `battle:${attack.reason}`);
  }
  const updated: DungeonState = {
    ...state,
    randomState: attack.state.randomState,
    party: updatePartyFromBattle(state, attack.state),
    activity: { type: "battle", state: attack.state },
  };
  if (attack.state.outcome === "victory" || attack.state.outcome === "defeat") {
    return {
      accepted: true,
      state: completeNode(updated, node.id, node.type, attack.state.outcome),
      events: attack.events,
      battleState: attack.state,
    };
  }
  return { accepted: true, state: updated, events: attack.events, battleState: attack.state };
}

export function performDungeonBasicAttack(
  state: DungeonState,
  actorId: string,
  targetId: string,
  definition: DungeonDefinition,
): DungeonActionResult {
  return resolveDungeonBattleAction(state, definition, (battle) =>
    performBasicAttackAndAdvanceToAllyInput(battle, actorId, targetId),
  );
}
export interface DungeonSkillInput {
  readonly actorId: string;
  readonly targetId: string;
  readonly skillId: string;
  readonly expectedActionTime: number;
  readonly expectedNodeId: string;
  readonly expeditionActionId: number;
}
export function performDungeonSkill(
  state: DungeonState,
  input: DungeonSkillInput,
  definition: DungeonDefinition,
  rules: BattleSkillRules,
): DungeonActionResult {
  if (state.expeditionActionId !== input.expeditionActionId || state.activeNodeId !== input.expectedNodeId)
    return reject(state, "battle:action-not-current");
  return resolveDungeonBattleAction(state, definition, (battle) =>
    performBattleSkillAndAdvanceToAllyInput(
      battle,
      input.actorId,
      input.targetId,
      input.skillId,
      input.expectedActionTime,
      rules.catalog,
      rules.fatigue,
    ),
  );
}
