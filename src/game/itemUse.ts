import { advanceBattleToNextActor, type BattleCombatantDefinition, type BattleState } from "./battle";
import { completeCurrentAction } from "./battleTimeline";
import { type DungeonDefinition, type DungeonState, getAvailableDungeonNodes } from "./dungeon";
import { type BagStack, consumeBagItem, type ItemCatalog, type ItemState } from "./items";
import { canParticipate, effectiveMaxHp, healthyStatus } from "./status";

export interface RecoveryItemInput {
  readonly expectedVersion: number;
  readonly explorationId: number;
  readonly itemId: string;
  readonly origin: BagStack["origin"];
  readonly targetId: string;
}
function healTarget<T extends BattleCombatantDefinition>(
  target: T | undefined,
  itemId: string,
  catalog: ItemCatalog,
): T | null {
  const item = catalog.find(({ id }) => id === itemId);
  if (target?.team !== "ally" || !canParticipate(target.hp, target.status) || item?.kind !== "consumable") return null;
  if (!Number.isFinite(item.hpRecovery) || item.hpRecovery <= 0) throw new Error("回復量は正の有限値です");
  const maxHp = effectiveMaxHp(target.maxHp ?? target.hp, target.status ?? healthyStatus());
  return { ...target, hp: Math.min(maxHp, target.hp + item.hpRecovery) };
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
  const healed = healTarget(target, input.itemId, catalog);
  if (!healed || !target) return rejected;
  const consumed = consumeBagItem(items, input.expectedVersion, input.itemId, input.origin, catalog);
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
  const healed = healTarget(target, input.itemId, catalog);
  if (!healed || !target) return rejected;
  const consumed = consumeBagItem(items, input.expectedVersion, input.itemId, input.origin, catalog);
  if (!consumed.accepted) return rejected;
  return {
    accepted: true as const,
    items: consumed.state,
    dungeon: { ...dungeon, party: dungeon.party.map((c) => (c.id === healed.id ? healed : c)) },
    event: { type: "item-recovery" as const, itemId: input.itemId, targetId: target.id, amount: healed.hp - target.hp },
  };
}
