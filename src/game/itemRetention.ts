import { nextGameRandom } from "./gameRandom";
import type { RetentionPolicy } from "./items";

/** One seeded game roll per item, for carried and acquired stacks alike. */
export function independentItemRetention(probability: number): RetentionPolicy {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1)
    throw new RangeError("保持確率は0以上1以下です");
  return (bag, seed) => {
    let randomState = seed;
    const quantities = bag.map(({ quantity }) => {
      let kept = 0;
      for (let i = 0; i < quantity; i++) {
        const roll = nextGameRandom(randomState);
        randomState = roll.state;
        if (roll.value < probability) kept++;
      }
      return kept;
    });
    return { quantities, randomState };
  };
}
