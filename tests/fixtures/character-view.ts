import { characters } from "../../src/content/characters";
import { growthRules } from "../../src/content/growthRules";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { mentalFatigueDefinition } from "../../src/content/mentalFatigueDefinition";
import { skillCatalog } from "../../src/content/skillDefinitions";
import type { BattleSkillRules } from "../../src/game/battle";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { applyPartyStatus, type ExpeditionGame } from "../../src/game/expedition";
import { chooseGrowthSkill, grownCharacters, rewardGrowth } from "../../src/game/growthRuntime";
import { createParty } from "../../src/game/party";
import { createCharacterDetailsModel, reduceCharacterDetails } from "../../src/presentation/characterDetails";
import { createCharacterDetailsView } from "../../src/web/characterDetailsUi";
import { requiredElement } from "../../src/web/requiredElement";
import "../../src/web/style.css";

// The same public fixture definitions and confirmed Lv4 result as the old long-detail picture.
// No browser action advances the game; the view receives the completed display snapshot.
const definitions = characters.map((character) =>
  character.id === "player"
    ? { ...character, name: "長い名前のロッシ（習得した技と現在の状態を確認する）" }
    : character,
);
const catalog = {
  ...skillCatalog,
  skills: skillCatalog.skills.map((skill) =>
    skill.id === "test-heal"
      ? { ...skill, description: skill.description.repeat(12) }
      : skill.id === "test-strength" && skill.type === "passive"
        ? { ...skill, effect: { ...skill.effect, rankAmounts: [2, 4, 6] } }
        : skill,
  ),
  pools: skillCatalog.pools.map((pool) => ({
    ...pool,
    candidates: { ...pool.candidates, normal: ["test-strength", "test-vitality", "test-power"] },
  })),
  characters: skillCatalog.characters.map((profile) => ({
    ...profile,
    guaranteedUnlocks: [{ skillId: "test-light-strike", level: 2 }],
    initialSkillIds: [...(profile.initialSkillIds ?? []), "test-strength"],
  })),
};
const rules: BattleSkillRules = {
  catalog,
  fatigue: mentalFatigueDefinition,
  growth: { ...growthRules, characters: definitions },
};
let game: ExpeditionGame = {
  adventure: createInitialGameState(initialGameOptions),
  party: createParty(definitions, ["player"]),
  dungeon: null,
  randomState: 731,
};
const reward = rewardGrowth(game, { allocations: [{ characterId: "player", experience: 30 }] }, rules);
if (!reward.accepted) throw new Error(reward.reason);
game = reward.state;
for (const skillId of ["test-strength", "test-vitality", "test-vitality"]) {
  const choice = chooseGrowthSkill(game, skillId, rules);
  if (!choice.accepted) throw new Error(choice.reason);
  game = choice.state;
}
game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 25 }, definitions);
game = applyPartyStatus(game, "player", { kind: "haze", amount: 25 }, definitions);
const root = requiredElement<HTMLElement>(document, "#fixture");
const opener = document.createElement("button");
opener.type = "button";
opener.textContent = `${definitions[0].name}の詳細`;
root.append(opener);
const grown = grownCharacters(game, rules);
let snapshot = reduceCharacterDetails(createCharacterDetailsModel(), {
  type: "open",
  characterId: "player",
  input: {
    characters: grown,
    party: game.party,
    context: { characters: grown, baseCharacters: definitions, growth: game.growth, rules },
  },
}).state;
const view = createCharacterDetailsView(
  root,
  () => false,
  () => {},
);
// The old reference opened this native modal from an already laid-out, focused opener.
await document.fonts.ready;
opener.focus();
view.render(snapshot);
Object.assign(window, {
  paintCharacterScroll(scrollTop: number) {
    snapshot = { ...snapshot, scrollTop, focus: { kind: "information" } };
    view.render(snapshot);
  },
});
