/** Game decisions use this seeded uint32 stream, independently of presentation randomness. */
export function createGameRandom(seed = 1): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("乱数seedはuint32です");
  return seed;
}
export function nextGameRandom(state: number): { readonly state: number; readonly value: number } {
  const next = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return { state: next, value: next / 0x100000000 };
}
