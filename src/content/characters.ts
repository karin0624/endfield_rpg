import type { CharacterDefinition } from "../game/party";

/** Existing prototype values; Rossi keeps the battle ID player. */
export const characters = [
  { id: "player", name: "ロッシ", maxHp: 20, speed: 100, attackPower: 8 },
  { id: "gilberta", name: "ギルベルタ", maxHp: 18, speed: 90, attackPower: 6 },
] as const satisfies readonly CharacterDefinition[];
