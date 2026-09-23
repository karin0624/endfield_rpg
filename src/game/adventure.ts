import type { GameState } from "./createInitialGameState";

export type CharacterPosition = "left" | "center" | "right";

export interface ConversationPresentation {
  readonly speakerName?: string;
  readonly backgroundId?: string;
  readonly portraitId?: string;
  readonly expressionId?: string;
  readonly position?: CharacterPosition;
}

export interface FlagCondition {
  readonly all?: readonly string[];
  readonly none?: readonly string[];
}

export interface ConversationRoute {
  readonly conversationId: string;
  readonly when?: FlagCondition;
}

export interface TownPlaceDefinition {
  readonly id: string;
  readonly label: string;
  readonly availableWhen?: FlagCondition;
  /** 条件に合う最初のルートを使う。条件なしの既定ルートは最後に置く。 */
  readonly routes: readonly ConversationRoute[];
}

export interface ConversationLineNode extends ConversationPresentation {
  readonly type: "line";
  readonly text: string;
  readonly nextNodeId: string;
}

export interface ConversationChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly nextNodeId: string;
  readonly when?: FlagCondition;
  readonly setFlags?: readonly string[];
}

export interface ConversationChoiceNode extends ConversationPresentation {
  readonly type: "choice";
  readonly prompt?: string;
  readonly options: readonly ConversationChoiceOption[];
}

export interface ConversationEndNode {
  readonly type: "end";
}

export type ConversationNode = ConversationLineNode | ConversationChoiceNode | ConversationEndNode;

export interface ConversationDefinition {
  readonly id: string;
  readonly startNodeId: string;
  readonly nodes: Readonly<Record<string, ConversationNode>>;
  readonly onCompleteFlags?: readonly string[];
}

export interface AdventureDefinition {
  readonly places: readonly TownPlaceDefinition[];
  readonly conversations: readonly ConversationDefinition[];
}

export interface TownPlaceOption {
  readonly id: string;
  readonly label: string;
}

export type ConversationScene =
  | {
      readonly type: "line";
      readonly conversationId: string;
      readonly nodeId: string;
      readonly text: string;
      readonly presentation: ConversationPresentation;
    }
  | {
      readonly type: "choice";
      readonly conversationId: string;
      readonly nodeId: string;
      readonly prompt?: string;
      readonly options: readonly Pick<ConversationChoiceOption, "id" | "label">[];
      readonly presentation: ConversationPresentation;
    };

export type AdventureRejectionReason =
  | "not-in-town"
  | "place-unavailable"
  | "not-in-conversation"
  | "not-a-line"
  | "not-a-choice"
  | "choice-unavailable"
  | "conversation-progress-invalid";

export type AdventureActionResult =
  | { readonly accepted: true; readonly state: GameState }
  | { readonly accepted: false; readonly reason: AdventureRejectionReason; readonly state: GameState };

function findPlace(definition: AdventureDefinition, placeId: string): TownPlaceDefinition | undefined {
  return definition.places.find((place) => place.id === placeId);
}

function findConversation(definition: AdventureDefinition, conversationId: string): ConversationDefinition | undefined {
  return definition.conversations.find((conversation) => conversation.id === conversationId);
}

function hasFlags(flags: readonly string[], condition?: FlagCondition): boolean {
  if (condition === undefined) {
    return true;
  }

  return (
    (condition.all ?? []).every((flag) => flags.includes(flag)) &&
    (condition.none ?? []).every((flag) => !flags.includes(flag))
  );
}

function getMatchingRoute(state: GameState, place: TownPlaceDefinition): ConversationRoute | undefined {
  return place.routes.find((route) => hasFlags(state.flags, route.when));
}

function getNode(conversation: ConversationDefinition, nodeId: string): ConversationNode | undefined {
  return conversation.nodes[nodeId];
}

function withAddedFlags(flags: readonly string[], additions: readonly string[] = []): string[] {
  return [...new Set([...flags, ...additions])];
}

function reject(state: GameState, reason: AdventureRejectionReason): AdventureActionResult {
  return { accepted: false, reason, state };
}

function enterNodeOrFinish(
  state: GameState,
  conversation: ConversationDefinition,
  nodeId: string,
  flags: readonly string[] = state.flags,
): GameState {
  const node = getNode(conversation, nodeId);
  if (node === undefined) {
    throw new Error(`会話の進行先が存在しません: ${conversation.id}/${nodeId}`);
  }
  if (node.type === "end") {
    return {
      ...state,
      mode: "town",
      conversationId: null,
      conversationPosition: null,
      flags: withAddedFlags(flags, conversation.onCompleteFlags),
    };
  }

  return {
    ...state,
    conversationPosition: nodeId,
    flags: [...flags],
  };
}

function assertNonEmpty(value: string, context: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${context}は空にできません`);
  }
}

function assertValidCondition(condition: FlagCondition | undefined, context: string): void {
  if (condition === undefined) {
    return;
  }
  for (const flag of [...(condition.all ?? []), ...(condition.none ?? [])]) {
    assertNonEmpty(flag, `${context}のフラグID`);
  }
}

/** 会話・場所データの参照先と、条件分岐の既定経路を検査する。 */
export function assertValidAdventureDefinition(definition: AdventureDefinition): void {
  const placeIds = new Set<string>();
  for (const place of definition.places) {
    assertNonEmpty(place.id, "場所ID");
    assertNonEmpty(place.label, `場所${place.id}の表示名`);
    if (placeIds.has(place.id)) {
      throw new Error(`場所IDが重複しています: ${place.id}`);
    }
    placeIds.add(place.id);
    if (place.routes.length === 0) {
      throw new Error(`場所に会話ルートがありません: ${place.id}`);
    }
    assertValidCondition(place.availableWhen, `場所${place.id}`);
    let foundDefaultRoute = false;
    place.routes.forEach((route, index) => {
      assertNonEmpty(route.conversationId, `場所${place.id}の会話ID`);
      assertValidCondition(route.when, `場所${place.id}の会話ルート`);
      if (route.when === undefined) {
        if (index !== place.routes.length - 1) {
          throw new Error(`条件なしの会話ルートは最後に置いてください: ${place.id}`);
        }
        foundDefaultRoute = true;
      }
    });
    if (!foundDefaultRoute) {
      throw new Error(`場所には条件なしの会話ルートが必要です: ${place.id}`);
    }
  }

  const conversationIds = new Set<string>();
  for (const conversation of definition.conversations) {
    assertNonEmpty(conversation.id, "会話ID");
    if (conversationIds.has(conversation.id)) {
      throw new Error(`会話IDが重複しています: ${conversation.id}`);
    }
    conversationIds.add(conversation.id);
    assertNonEmpty(conversation.startNodeId, `会話${conversation.id}の開始位置`);
    if (conversation.onCompleteFlags !== undefined) {
      for (const flag of conversation.onCompleteFlags) {
        assertNonEmpty(flag, `会話${conversation.id}の完了フラグID`);
      }
    }
    const startNode = getNode(conversation, conversation.startNodeId);
    if (startNode === undefined || startNode.type === "end") {
      throw new Error(`会話の開始位置が不正です: ${conversation.id}/${conversation.startNodeId}`);
    }
    const nodeEntries = Object.entries(conversation.nodes);
    if (nodeEntries.length === 0) {
      throw new Error(`会話に場面がありません: ${conversation.id}`);
    }
    for (const [nodeId, node] of nodeEntries) {
      assertNonEmpty(nodeId, `会話${conversation.id}の場面ID`);
      if (node.type === "line") {
        assertNonEmpty(node.text, `会話${conversation.id}/${nodeId}の本文`);
        assertNonEmpty(node.nextNodeId, `会話${conversation.id}/${nodeId}の進行先`);
        if (getNode(conversation, node.nextNodeId) === undefined) {
          throw new Error(`会話の進行先が存在しません: ${conversation.id}/${nodeId} → ${node.nextNodeId}`);
        }
      } else if (node.type === "choice") {
        if (node.options.length === 0) {
          throw new Error(`選択肢がありません: ${conversation.id}/${nodeId}`);
        }
        const optionIds = new Set<string>();
        let foundDefaultOption = false;
        node.options.forEach((option) => {
          assertNonEmpty(option.id, `会話${conversation.id}/${nodeId}の選択肢ID`);
          assertNonEmpty(option.label, `会話${conversation.id}/${nodeId}の選択肢表示名`);
          if (optionIds.has(option.id)) {
            throw new Error(`選択肢IDが重複しています: ${conversation.id}/${nodeId}/${option.id}`);
          }
          optionIds.add(option.id);
          assertNonEmpty(option.nextNodeId, `選択肢${option.id}の進行先`);
          if (getNode(conversation, option.nextNodeId) === undefined) {
            throw new Error(
              `選択肢の進行先が存在しません: ${conversation.id}/${nodeId}/${option.id} → ${option.nextNodeId}`,
            );
          }
          assertValidCondition(option.when, `選択肢${conversation.id}/${nodeId}/${option.id}`);
          if (option.when === undefined) {
            foundDefaultOption = true;
          }
          for (const flag of option.setFlags ?? []) {
            assertNonEmpty(flag, `選択肢${conversation.id}/${nodeId}/${option.id}の更新フラグID`);
          }
        });
        if (!foundDefaultOption) {
          throw new Error(`選択肢には条件なしの既定選択肢が必要です: ${conversation.id}/${nodeId}`);
        }
      }
    }
  }

  for (const place of definition.places) {
    for (const route of place.routes) {
      if (!conversationIds.has(route.conversationId)) {
        throw new Error(`場所が参照する会話が存在しません: ${place.id}/${route.conversationId}`);
      }
    }
  }
}

/** 現在の街から選択できる場所を返す。表示の問い合わせでは状態を変更しない。 */
export function getAvailableTownPlaces(state: GameState, definition: AdventureDefinition): TownPlaceOption[] {
  if (state.mode !== "town") {
    return [];
  }

  return definition.places
    .filter((place) => hasFlags(state.flags, place.availableWhen) && getMatchingRoute(state, place) !== undefined)
    .map(({ id, label }) => ({ id, label }));
}

/** 街で場所を選び、条件に合う会話の開始位置へ移動する。 */
export function selectTownPlace(
  state: GameState,
  placeId: string,
  definition: AdventureDefinition,
): AdventureActionResult {
  if (state.mode !== "town") {
    return reject(state, "not-in-town");
  }

  const place = findPlace(definition, placeId);
  if (place === undefined || !hasFlags(state.flags, place.availableWhen)) {
    return reject(state, "place-unavailable");
  }
  const route = getMatchingRoute(state, place);
  const conversation = route === undefined ? undefined : findConversation(definition, route.conversationId);
  if (conversation === undefined) {
    return reject(state, "place-unavailable");
  }

  const startNode = getNode(conversation, conversation.startNodeId);
  if (startNode === undefined || startNode.type === "end") {
    return reject(state, "conversation-progress-invalid");
  }

  return {
    accepted: true,
    state: {
      ...state,
      mode: "conversation",
      currentPlaceId: place.id,
      conversationId: conversation.id,
      conversationPosition: conversation.startNodeId,
    },
  };
}

/** 現在の会話場面を表示用に返す。呼び出しても進行やフラグは変わらない。 */
export function getCurrentConversationScene(
  state: GameState,
  definition: AdventureDefinition,
): ConversationScene | null {
  if (state.mode !== "conversation" || state.conversationId === null || state.conversationPosition === null) {
    return null;
  }
  const conversation = findConversation(definition, state.conversationId);
  const node = conversation === undefined ? undefined : getNode(conversation, state.conversationPosition);
  if (conversation === undefined || node === undefined || node.type === "end") {
    return null;
  }

  const presentation: ConversationPresentation = {
    speakerName: node.speakerName,
    backgroundId: node.backgroundId,
    portraitId: node.portraitId,
    expressionId: node.expressionId,
    position: node.position,
  };
  if (node.type === "line") {
    return {
      type: "line",
      conversationId: conversation.id,
      nodeId: state.conversationPosition,
      text: node.text,
      presentation,
    };
  }

  return {
    type: "choice",
    conversationId: conversation.id,
    nodeId: state.conversationPosition,
    prompt: node.prompt,
    options: node.options
      .filter((option) => hasFlags(state.flags, option.when))
      .map(({ id, label }) => ({ id, label })),
    presentation,
  };
}

/** 文章送り。無効な入力は状態を同じ参照のまま返す。 */
export function advanceConversation(state: GameState, definition: AdventureDefinition): AdventureActionResult {
  if (state.mode !== "conversation" || state.conversationId === null || state.conversationPosition === null) {
    return reject(state, "not-in-conversation");
  }
  const conversation = findConversation(definition, state.conversationId);
  const node = conversation === undefined ? undefined : getNode(conversation, state.conversationPosition);
  if (conversation === undefined || node === undefined) {
    return reject(state, "conversation-progress-invalid");
  }
  if (node.type !== "line") {
    return reject(state, "not-a-line");
  }

  return {
    accepted: true,
    state: enterNodeOrFinish(state, conversation, node.nextNodeId),
  };
}

/** 選択肢を確定する。表示条件を満たさない選択肢は直接指定しても拒否する。 */
export function chooseConversationOption(
  state: GameState,
  optionId: string,
  definition: AdventureDefinition,
): AdventureActionResult {
  if (state.mode !== "conversation" || state.conversationId === null || state.conversationPosition === null) {
    return reject(state, "not-in-conversation");
  }
  const conversation = findConversation(definition, state.conversationId);
  const node = conversation === undefined ? undefined : getNode(conversation, state.conversationPosition);
  if (conversation === undefined || node === undefined) {
    return reject(state, "conversation-progress-invalid");
  }
  if (node.type !== "choice") {
    return reject(state, "not-a-choice");
  }
  const option = node.options.find((candidate) => candidate.id === optionId);
  if (option === undefined || !hasFlags(state.flags, option.when)) {
    return reject(state, "choice-unavailable");
  }

  const flags = withAddedFlags(state.flags, option.setFlags);
  return {
    accepted: true,
    state: enterNodeOrFinish(state, conversation, option.nextNodeId, flags),
  };
}
