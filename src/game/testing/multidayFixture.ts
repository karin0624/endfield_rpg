import { growthRules } from "../../content/growthRules";
import { initialAdventure } from "../../content/initialAdventure";
import { initialGameOptions } from "../../content/initialGameOptions";
import { loadSymptomDefinition } from "../../content/loadSymptomDefinition";
import { mentalFatigueDefinition } from "../../content/mentalFatigueDefinition";
import { skillCatalog } from "../../content/skillDefinitions";
import type { ContentDefinitions } from "../../content/validateContent";
import type { AdventureDefinition } from "../adventure";
import type { DungeonDefinition } from "../dungeon";
import type { SkillCatalog } from "../skills";

/** Independent legal definitions: five recruits, town10 XP and a small heal with load50.
 * This exercises full slots plus a grown reserve; it is not production content/balance. */
export function multidayFixture(outcome: "cleared" | "failed"): ContentDefinitions {
  const characters = ["player", "a", "b", "c", "reserve"].map((id) => ({
    id,
    name: id,
    maxHp: 200,
    speed: 100,
    attackPower: 20,
  }));
  const adventure: AdventureDefinition = {
    ...initialAdventure,
    places: [
      ...initialAdventure.places,
      { id: "recruit", label: "受入用加入", routes: [{ conversationId: "recruit" }] },
    ],
    conversations: [
      ...initialAdventure.conversations.filter(({ id }) => !id.startsWith("gilberta-")),
      {
        id: "recruit",
        startNodeId: "line",
        nodes: {
          line: { type: "line", text: "加入", nextNodeId: "end" },
          end: {
            type: "end",
            recruitments: characters.slice(1).map(({ id }) => ({
              characterId: id,
              when: { none: [`joined-${id}`] },
              setFlags: [`joined-${id}`],
            })),
          },
        },
      },
    ],
  };
  // Remove the production-only companion place together with its conversation references.
  const legalAdventure = { ...adventure, places: adventure.places.filter(({ id }) => id !== "find-companion") };
  const skills: SkillCatalog = {
    ...skillCatalog,
    skills: skillCatalog.skills.map((skill) =>
      skill.id === "test-heal"
        ? {
            ...skill,
            mentalFatigueIncrease: 50,
            description: "受入用回復: HPを8＋最大HP×0.05回復、精神疲労50。",
            effect: { type: "hp-recovery", amount: 8, scaling: { stat: "maxHp", coefficient: 0.05 } },
          }
        : skill,
    ),
    pools: [
      {
        ...skillCatalog.pools[0],
        candidates: {
          ...skillCatalog.pools[0].candidates,
          normal: ["test-strength", "test-power", "test-vitality"],
        },
      },
    ],
    characters: characters.map(({ id }) => ({
      characterId: id,
      poolId: "test-shared",
      initialSkillIds: ["test-heal"],
      guaranteedUnlocks: [{ level: 3, skillId: "test-light-strike" }],
    })),
  };
  const growth = {
    ...growthRules,
    characters,
    townExperience: 10,
    progression: {
      ...growthRules.progression,
      initial: characters.map(({ id }) => ({
        characterId: id,
        level: 1,
        experience: 0,
        bonus: { maxHp: 0, attackPower: 0 },
      })),
    },
  };
  const dungeon: DungeonDefinition = {
    id: "acceptance",
    entryNodeId: "start",
    nodes: [
      { id: "start", label: "入口", type: "start", nextNodeIds: ["fight"] },
      {
        id: "fight",
        label: "戦闘",
        type: "battle",
        nextNodeIds: ["boss"],
        enemies: [{ id: "enemy", team: "enemy", hp: 20, speed: 101, attackPower: 190 }],
      },
      {
        id: "boss",
        label: "ボス",
        type: "boss",
        nextNodeIds: [],
        enemies: [
          {
            id: "boss-enemy",
            team: "enemy",
            hp: outcome === "cleared" ? 60 : 1000,
            speed: outcome === "cleared" ? 1 : 1000,
            attackPower: outcome === "cleared" ? 0 : 1000,
          },
        ],
      },
    ],
  };
  return {
    characters,
    adventure: legalAdventure,
    dungeon,
    initial: initialGameOptions,
    growth,
    skills,
    loadSymptoms: loadSymptomDefinition,
    save: {
      characters,
      placeIds: legalAdventure.places.map(({ id }) => id),
      recruitmentFlags: characters.slice(1).map(({ id }) => ({ flag: `joined-${id}`, characterId: id })),
      skills: { catalog: skills, growth, fatigue: mentalFatigueDefinition },
    },
  };
}
