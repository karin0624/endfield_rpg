import { initialAdventure } from "../../src/content/initialAdventure";
import { actInTown, beginTownExploration, type ExpeditionGame } from "../../src/game/expedition";
import type { MentalFatigueDefinition } from "../../src/game/mentalFatigue";
import type { CharacterDefinition } from "../../src/game/party";

/** One real town exploration, with no growth rules when the test concerns recovery alone. */
export function completeMarketVisit(
  game: ExpeditionGame,
  characters: readonly CharacterDefinition[],
  fatigue?: MentalFatigueDefinition,
): ExpeditionGame {
  const started = beginTownExploration(game, "market", initialAdventure);
  if (!started.accepted) throw new Error(started.reason);
  const completed = actInTown(started.state, { type: "advance" }, characters, initialAdventure, fatigue);
  if (!completed.accepted) throw new Error(completed.reason);
  return completed.state;
}
