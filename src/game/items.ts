/** IDs are shared by home stock and exploration loot. */
export type ItemDefinition =
  | { readonly id: string; readonly kind: "consumable"; readonly hpRecovery: number }
  | { readonly id: string; readonly kind: "material" }
  | { readonly id: string; readonly kind: "important" };
export type ItemCatalog = readonly ItemDefinition[];
export interface ItemStack {
  readonly itemId: string;
  readonly quantity: number;
}
export interface BagStack extends ItemStack {
  readonly origin: "carried" | "acquired";
}
export interface ItemState {
  readonly version: number;
  readonly home: readonly ItemStack[];
  readonly importantIds: readonly string[];
  readonly exploration: {
    readonly id: number;
    readonly destination: "town" | "dungeon";
    readonly bag: readonly BagStack[];
    readonly rewardIds: readonly string[];
  } | null;
}
export type ItemRejection = "stale-input" | "wrong-place" | "invalid-item" | "insufficient-stock" | "duplicate-reward";
export type ItemResult =
  | { readonly accepted: true; readonly state: ItemState }
  | { readonly accepted: false; readonly state: ItemState; readonly reason: ItemRejection };

export function createItemState(home: readonly ItemStack[], catalog: ItemCatalog): ItemState {
  if (home.some((stack) => !validStack(stack, catalog)) || new Set(home.map((s) => s.itemId)).size !== home.length)
    throw new Error("ホーム保管の定義が不正です");
  return { version: 0, home: home.map((s) => ({ ...s })), importantIds: [], exploration: null };
}
function validQuantity(quantity: number): boolean {
  return Number.isSafeInteger(quantity) && quantity > 0;
}
function validStack(stack: ItemStack, catalog: ItemCatalog): boolean {
  const item = catalog.find(({ id }) => id === stack.itemId);
  return validQuantity(stack.quantity) && (item?.kind === "consumable" || item?.kind === "material");
}
export function mergeStacks(stacks: readonly ItemStack[]): ItemStack[] {
  const result: ItemStack[] = [];
  for (const stack of stacks) {
    const index = result.findIndex(({ itemId }) => itemId === stack.itemId);
    const quantity = stack.quantity + (result[index]?.quantity ?? 0);
    if (!Number.isSafeInteger(quantity)) throw new RangeError("所持数が整数範囲を超えました");
    if (index < 0) result.push({ ...stack });
    else result[index] = { itemId: stack.itemId, quantity };
  }
  return result;
}
export function packItems(
  state: ItemState,
  expectedVersion: number,
  explorationId: number,
  destination: "town" | "dungeon",
  selection: readonly ItemStack[],
  catalog: ItemCatalog,
): ItemResult {
  if (state.version !== expectedVersion) return { accepted: false, state, reason: "stale-input" };
  if (state.exploration) return { accepted: false, state, reason: "wrong-place" };
  if (!Number.isSafeInteger(explorationId) || explorationId < 0) throw new RangeError("探索IDが不正です");
  if (selection.some((s) => !validStack(s, catalog))) return { accepted: false, state, reason: "invalid-item" };
  const selected = mergeStacks(selection);
  if (selected.some((s) => s.quantity > (state.home.find((h) => h.itemId === s.itemId)?.quantity ?? 0)))
    return { accepted: false, state, reason: "insufficient-stock" };
  return {
    accepted: true,
    state: {
      ...state,
      version: state.version + 1,
      home: state.home
        .map((s) => ({ ...s, quantity: s.quantity - (selected.find((p) => p.itemId === s.itemId)?.quantity ?? 0) }))
        .filter((s) => s.quantity > 0),
      exploration: {
        id: explorationId,
        destination,
        bag: selected.map((s) => ({ ...s, origin: "carried" })),
        rewardIds: [],
      },
    },
  };
}
/** The caller identifies a resolved battle/event; retries cannot grant its loot again. */
export function receiveItems(
  state: ItemState,
  expectedVersion: number,
  rewardId: string,
  loot: readonly ItemStack[],
  catalog: ItemCatalog,
): ItemResult {
  if (state.version !== expectedVersion) return { accepted: false, state, reason: "stale-input" };
  const exploration = state.exploration;
  if (!exploration) return { accepted: false, state, reason: "wrong-place" };
  if (exploration.rewardIds.includes(rewardId)) return { accepted: false, state, reason: "duplicate-reward" };
  if (loot.some((s) => !validStack(s, catalog))) return { accepted: false, state, reason: "invalid-item" };
  return {
    accepted: true,
    state: {
      ...state,
      version: state.version + 1,
      exploration: {
        ...exploration,
        rewardIds: [...exploration.rewardIds, rewardId],
        bag: [
          ...exploration.bag.filter((s) => s.origin === "carried"),
          ...mergeStacks([...exploration.bag.filter((s) => s.origin === "acquired"), ...loot]).map(
            (s): BagStack => ({ ...s, origin: "acquired" }),
          ),
        ],
      },
    },
  };
}
export function acquireImportantItem(state: ItemState, itemId: string, catalog: ItemCatalog): ItemResult {
  if (catalog.find(({ id }) => id === itemId)?.kind !== "important")
    return { accepted: false, state, reason: "invalid-item" };
  if (state.importantIds.includes(itemId)) return { accepted: true, state };
  return {
    accepted: true,
    state: { ...state, version: state.version + 1, importantIds: [...state.importantIds, itemId] },
  };
}
/** UI sees one count; origin is internal accounting only. */
export function bagItemQuantity(state: ItemState, itemId: string): number {
  return state.exploration?.bag.filter((s) => s.itemId === itemId).reduce((total, s) => total + s.quantity, 0) ?? 0;
}
/** Consume carried stock first, then acquired stock, without asking the player. */
export function consumeBagItem(
  state: ItemState,
  expectedVersion: number,
  itemId: string,
  catalog: ItemCatalog,
): ItemResult {
  if (state.version !== expectedVersion) return { accepted: false, state, reason: "stale-input" };
  const exploration = state.exploration;
  if (!exploration) return { accepted: false, state, reason: "wrong-place" };
  if (catalog.find(({ id }) => id === itemId)?.kind !== "consumable")
    return { accepted: false, state, reason: "invalid-item" };
  const stack =
    exploration.bag.find((s) => s.itemId === itemId && s.origin === "carried") ??
    exploration.bag.find((s) => s.itemId === itemId && s.origin === "acquired");
  if (!stack) return { accepted: false, state, reason: "insufficient-stock" };
  return {
    accepted: true,
    state: {
      ...state,
      version: state.version + 1,
      exploration: {
        ...exploration,
        bag: exploration.bag
          .map((s) => (s === stack ? { ...s, quantity: s.quantity - 1 } : s))
          .filter((s) => s.quantity > 0),
      },
    },
  };
}
/** Loss percentage and sampling method are supplied together; neither has a default. */
export type RetentionPolicy = (
  bag: readonly BagStack[],
  randomState: number,
  outcome: "defeat" | "retreat",
) => {
  readonly quantities: readonly number[];
  readonly randomState: number;
};
export function returnItems(
  state: ItemState,
  expectedVersion: number,
  explorationId: number,
  outcome: "cleared" | "defeat" | "retreat",
  randomState: number,
  retention?: RetentionPolicy,
): ItemResult & { readonly randomState: number; readonly lost?: readonly BagStack[] } {
  if (state.version !== expectedVersion) return { accepted: false, state, reason: "stale-input", randomState };
  const exploration = state.exploration;
  if (!exploration || exploration.id !== explorationId)
    return { accepted: false, state, reason: "wrong-place", randomState };
  let retained = { quantities: exploration.bag.map((s) => s.quantity) as readonly number[], randomState };
  if (outcome !== "cleared") {
    if (!retention) throw new Error("ロストの調整方針が必要です");
    retained = retention(exploration.bag, randomState, outcome);
  }
  if (
    retained.quantities.length !== exploration.bag.length ||
    retained.quantities.some((q, i) => !Number.isSafeInteger(q) || q < 0 || q > exploration.bag[i].quantity) ||
    !Number.isInteger(retained.randomState) ||
    retained.randomState < 0 ||
    retained.randomState > 0xffffffff
  )
    throw new Error("保持抽選の結果が不正です");
  const kept = exploration.bag
    .map((s, i) => ({ itemId: s.itemId, quantity: retained.quantities[i] }))
    .filter((s) => s.quantity > 0);
  return {
    accepted: true,
    randomState: retained.randomState,
    lost: exploration.bag
      .map((s, i) => ({ ...s, quantity: s.quantity - retained.quantities[i] }))
      .filter((s) => s.quantity > 0),
    state: { ...state, version: state.version + 1, home: mergeStacks([...state.home, ...kept]), exploration: null },
  };
}

export interface ItemRecoveryEvent {
  readonly type: "item-recovery";
  readonly actorId?: string;
  readonly targetId: string;
  readonly itemId: string;
  readonly amount: number;
}
