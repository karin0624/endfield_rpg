import type { GrowthRules } from "../game/growthRuntime";
import { characters } from "./characters";

/** Provisional single-floor trial: at most 5 town XP + 25 route XP = Lv4.
 * Town reward is once per temporary growth session, not repeatable training.
 * Final boss awards zero. These are balance data, not permanent power. */
export const growthRules: GrowthRules = {
  characters,
  progression: {
    initial: characters.map(({ id }) => ({
      characterId: id,
      level: 1,
      experience: 0,
      bonus: { maxHp: 0, attackPower: 0 },
    })),
    rules: [1, 2, 3, 4].map((fromLevel) => ({
      fromLevel,
      requiredExperience: 10,
      bonus: { maxHp: 4, attackPower: 1 },
    })),
  },
  battleExperience: 25,
  eventExperience: 15,
  townExperience: 5,
};
