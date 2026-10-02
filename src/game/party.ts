import { hasFlags, type RecruitmentEffect } from "./adventure";
import type { BattleCombatantDefinition } from "./battle";
import { initialLearnedSkills, type SkillCatalog } from "./skills";
import { type CharacterStatus, canParticipate, healthyStatus } from "./status";

export interface CharacterDefinition {
  readonly id: string;
  readonly name: string;
  readonly maxHp: number;
  readonly hitRate?: number;
  readonly speed: number;
  readonly attackPower: number;
}

export interface PartyMember {
  /** Persistent numeric fatigue, separate from staged symptoms; absence means legacy zero. */
  readonly mentalFatigue?: number;
  readonly status?: CharacterStatus;
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
      (definition.hitRate !== undefined &&
        (!Number.isFinite(definition.hitRate) || definition.hitRate < 0 || definition.hitRate > 1)) ||
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
  catalog?: SkillCatalog,
): BattleCombatantDefinition[] {
  return state.slots.flatMap((id) => {
    if (id === null) return [];
    const member = state.members.find((candidate) => candidate.id === id);
    if (member === undefined) throw new Error(`未加入のキャラクターです: ${id}`);
    const definition = characterById(definitions, id);
    return [
      {
        mentalFatigue: member.mentalFatigue ?? 0,
        learnedSkills: catalog ? initialLearnedSkills(catalog, id) : [],
        maxHp: definition.maxHp,
        hitRate: definition.hitRate,
        status: member.status ?? healthyStatus(),
        id,
        team: "ally" as const,
        hp: member.hp,
        speed: definition.speed,
        attackPower: definition.attackPower,
      },
    ];
  });
}

export function departureRejection(state: PartyState): PartyRejection | null {
  const selected = state.slots.filter((id) => id !== null);
  if (selected.length === 0) return "empty-party";
  if (!state.members.some((member) => selected.includes(member.id) && canParticipate(member.hp, member.status)))
    return "no-living-member";
  return null;
}

export type RecruitmentRejection = "unknown-character" | "recruitment-unavailable";
/** Enrollment never edits slots or recreates a previously joined character. */
export function recruitPartyMember(
  state: PartyState,
  effect: RecruitmentEffect,
  definitions: readonly CharacterDefinition[],
  flags: readonly string[],
):
  | { readonly accepted: true; readonly state: PartyState; readonly added: boolean }
  | { readonly accepted: false; readonly state: PartyState; readonly reason: RecruitmentRejection } {
  if (!definitions.some(({ id }) => id === effect.characterId))
    return { accepted: false, state, reason: "unknown-character" };
  if (state.members.some(({ id }) => id === effect.characterId)) return { accepted: true, state, added: false };
  if (!hasFlags(flags, effect.when)) return { accepted: false, state, reason: "recruitment-unavailable" };
  const member = createParty(definitions, [effect.characterId]).members[0];
  return { accepted: true, added: true, state: { ...state, members: [...state.members, member] } };
}
