import {
  advanceBattleToNextActor,
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  type BattleState,
} from "./battle";
import { completeCurrentAction } from "./battleTimeline";
import {
  type DungeonActionResult,
  type DungeonDefinition,
  type DungeonState,
  getAvailableDungeonNodes,
  resolveDungeonBattleAction,
} from "./dungeon";
import { consumeBagItem, type ItemCatalog, type ItemState } from "./items";
import { canParticipate, effectiveMaxHp, healthyStatus } from "./status";

export interface RecoveryItemInput {
  readonly expectedVersion: number;
  readonly explorationId: number;
  readonly itemId: string;
  readonly targetId: string;
}
/** Target eligibility and actual recovery for selection UI; turn/session guards remain action-level checks. */
export function previewRecoveryItem(
  target: BattleCombatantDefinition | undefined,
  itemId: string,
  catalog: ItemCatalog,
):
  | { readonly usable: true; readonly amount: number }
  | { readonly usable: false; readonly amount: 0; readonly reason: "invalid-target" | "invalid-item" | "no-recovery" } {
  const item = catalog.find(({ id }) => id === itemId);
  if (item?.kind !== "consumable") return { usable: false, amount: 0, reason: "invalid-item" };
  if (target?.team !== "ally" || !canParticipate(target.hp, target.status))
    return { usable: false, amount: 0, reason: "invalid-target" };
  if (!Number.isFinite(item.hpRecovery) || item.hpRecovery <= 0) throw new Error("回復量は正の有限値です");
  const maxHp = effectiveMaxHp(target.maxHp ?? target.hp, target.status ?? healthyStatus());
  const amount = Math.min(Math.max(0, maxHp - target.hp), item.hpRecovery);
  return amount > 0 ? { usable: true, amount } : { usable: false, amount: 0, reason: "no-recovery" };
}

/** Pure atomic operation. Caller commits both states before displaying the event. */
export function useBattleRecoveryItem(
  items: ItemState,
  battle: BattleState,
  input: RecoveryItemInput & { readonly actorId: string; readonly expectedActionTime: number },
  catalog: ItemCatalog,
) {
  const rejected = { accepted: false as const, items, battle };
  const actor = battle.combatants.find(({ id }) => id === input.actorId);
  if (
    items.exploration?.id !== input.explorationId ||
    battle.outcome !== "ongoing" ||
    battle.logicalTime !== input.expectedActionTime ||
    battle.currentActorId !== input.actorId ||
    actor?.team !== "ally" ||
    !canParticipate(actor.hp, actor.status)
  )
    return rejected;
  const target = battle.combatants.find(({ id }) => id === input.targetId);
  const preview = previewRecoveryItem(target, input.itemId, catalog);
  if (!preview.usable || !target) return { ...rejected, preview };
  const healed = { ...target, hp: target.hp + preview.amount };
  const consumed = consumeBagItem(items, input.expectedVersion, input.itemId, catalog);
  if (!consumed.accepted) return rejected;
  const combatants = battle.combatants.map((c) => (c.id === healed.id ? healed : c));
  const timeline = completeCurrentAction({ ...battle, combatants });
  const nextBattle = advanceBattleToNextActor({
    ...battle,
    logicalTime: timeline.logicalTime,
    currentActorId: timeline.currentActorId,
    combatants: combatants.map((c, i) => ({ ...c, nextActionTime: timeline.combatants[i].nextActionTime })),
  });
  return {
    accepted: true as const,
    items: consumed.state,
    battle: nextBattle,
    event: {
      type: "item-recovery" as const,
      itemId: input.itemId,
      actorId: actor.id,
      targetId: target.id,
      amount: healed.hp - target.hp,
    },
  };
}
export function useBranchRecoveryItem(
  items: ItemState,
  dungeon: DungeonState,
  input: RecoveryItemInput & { readonly expectedNodeId: string },
  catalog: ItemCatalog,
  route: DungeonDefinition,
) {
  const rejected = { accepted: false as const, items, dungeon };
  if (
    items.exploration?.id !== input.explorationId ||
    dungeon.expeditionActionId !== input.explorationId ||
    dungeon.currentNodeId !== input.expectedNodeId ||
    dungeon.outcome !== "ongoing" ||
    dungeon.activity !== null ||
    dungeon.activeNodeId !== null ||
    dungeon.dungeonId !== route.id ||
    !getAvailableDungeonNodes(dungeon, route).length
  )
    return rejected;
  const target = dungeon.party.find(({ id }) => id === input.targetId);
  const preview = previewRecoveryItem(target, input.itemId, catalog);
  if (!preview.usable || !target) return { ...rejected, preview };
  const healed = { ...target, hp: target.hp + preview.amount };
  const consumed = consumeBagItem(items, input.expectedVersion, input.itemId, catalog);
  if (!consumed.accepted) return rejected;
  return {
    accepted: true as const,
    items: consumed.state,
    dungeon: { ...dungeon, party: dungeon.party.map((c) => (c.id === healed.id ? healed : c)) },
    event: { type: "item-recovery" as const, itemId: input.itemId, targetId: target.id, amount: healed.hp - target.hp },
  };
}

export type DungeonItemInput = RecoveryItemInput & { readonly expectedNodeId: string } & (
    | { readonly type: "item"; readonly actorId: string; readonly expectedActionTime: number }
    | { readonly type: "branch-item" }
  );
/** Bind the pure item operation to this exploration/node before running the existing enemy loop. */
export function performDungeonRecoveryItem(
  items: ItemState,
  dungeon: DungeonState,
  input: DungeonItemInput,
  catalog: ItemCatalog,
  route: DungeonDefinition,
): { readonly items: ItemState; readonly result: DungeonActionResult } {
  const reject = (): { items: ItemState; result: DungeonActionResult } => ({
    items,
    result: { accepted: false, state: dungeon, reason: "battle:action-not-current", events: [] },
  });
  if (dungeon.expeditionActionId !== input.explorationId || dungeon.currentNodeId !== input.expectedNodeId)
    return reject();
  if (input.type === "branch-item") {
    const used = useBranchRecoveryItem(items, dungeon, input, catalog, route);
    return used.accepted
      ? { items: used.items, result: { accepted: true, state: used.dungeon, events: [], itemRecovery: used.event } }
      : reject();
  }
  let nextItems = items;
  let itemRecovery: import("./items").ItemRecoveryEvent | undefined;
  const result = resolveDungeonBattleAction(dungeon, route, (battle) => {
    const used = useBattleRecoveryItem(items, battle, input, catalog);
    if (!used.accepted) return { accepted: false, state: battle, reason: "action-not-current", events: [] };
    nextItems = used.items;
    itemRecovery = used.event;
    const loop = advanceBattleToNextAllyInput(used.battle);
    return { accepted: true, state: loop.state, events: loop.events };
  });
  return { items: nextItems, result: result.accepted ? { ...result, itemRecovery } : result };
}
