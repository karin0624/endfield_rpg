import type { BattleCombatantDefinition } from "./battle";

export interface CharacterDefinition {
  readonly id: string;
  readonly name: string;
  readonly maxHp: number;
  readonly speed: number;
  readonly attackPower: number;
}

export interface PartyMember {
  readonly id: string;
  readonly hp: number;
}

export type PartySlots = readonly [string | null, string | null, string | null, string | null];
export interface PartyState {
  readonly members: readonly PartyMember[];
  readonly slots: PartySlots;
}

export type PartyRejection = "invalid-slot" | "not-joined" | "duplicate-member" | "empty-party" | "no-living-member";

export function characterById(definitions: readonly CharacterDefinition[], id: string): CharacterDefinition {
  const character = definitions.find((candidate) => candidate.id === id);
  if (character === undefined) throw new Error(`キャラクター定義がありません: ${id}`);
  return character;
}

/** Joined characters and slots are separate; no character state lives in a slot. */
export function createParty(definitions: readonly CharacterDefinition[], joinedIds: readonly string[]): PartyState {
  if (
    new Set(definitions.map(({ id }) => id)).size !== definitions.length ||
    new Set(joinedIds).size !== joinedIds.length
  ) {
    throw new Error("キャラクターIDが重複しています");
  }
  for (const definition of definitions) {
    if (
      !definition.id.trim() ||
      !definition.name.trim() ||
      !Number.isFinite(definition.maxHp) ||
      definition.maxHp <= 0 ||
      !Number.isFinite(definition.speed) ||
      definition.speed <= 0 ||
      !Number.isFinite(definition.attackPower) ||
      definition.attackPower < 0
    ) {
      throw new Error(`キャラクター定義が不正です: ${definition.id}`);
    }
  }
  return {
    members: joinedIds.map((id) => ({ id, hp: characterById(definitions, id).maxHp })),
    slots: [joinedIds[0] ?? null, null, null, null],
  };
}

export function setPartySlot(
  state: PartyState,
  slot: number,
  id: string | null,
):
  | { readonly accepted: true; readonly state: PartyState }
  | { readonly accepted: false; readonly state: PartyState; readonly reason: PartyRejection } {
  let reason: PartyRejection | undefined;
  if (!Number.isInteger(slot) || slot < 0 || slot >= 4) reason = "invalid-slot";
  else if (id !== null && !state.members.some((member) => member.id === id)) reason = "not-joined";
  else if (id !== null && state.slots.some((memberId, index) => index !== slot && memberId === id))
    reason = "duplicate-member";
  if (reason) return { accepted: false, state, reason };
  const slots: [string | null, string | null, string | null, string | null] = [...state.slots];
  slots[slot] = id;
  return { accepted: true, state: { ...state, slots } };
}

export function getPartyCombatants(
  state: PartyState,
  definitions: readonly CharacterDefinition[],
): BattleCombatantDefinition[] {
  return state.slots.flatMap((id) => {
    if (id === null) return [];
    const member = state.members.find((candidate) => candidate.id === id);
    if (member === undefined) throw new Error(`未加入のキャラクターです: ${id}`);
    const definition = characterById(definitions, id);
    return [{ id, team: "ally" as const, hp: member.hp, speed: definition.speed, attackPower: definition.attackPower }];
  });
}

export function departureRejection(state: PartyState): PartyRejection | null {
  const selected = state.slots.filter((id) => id !== null);
  if (selected.length === 0) return "empty-party";
  if (!state.members.some((member) => selected.includes(member.id) && member.hp > 0)) return "no-living-member";
  return null;
}
