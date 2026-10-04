import { mentalFatigueDefinition } from "../src/content/mentalFatigueDefinition";
import { skillCatalog } from "../src/content/skillDefinitions";
import {
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  createBattleState,
  performBattleSkillAndAdvanceToAllyInput,
} from "../src/game/battle";
import { type BattleInput, createBattleModel, reduceBattleModel } from "../src/presentation/battleModel";

/** The same actual core record supplies independent DOM and last-painted canvas samples. */
export function battlePictures(effect: "attack" | "heal") {
  const definitions: readonly BattleCombatantDefinition[] = [
    {
      id: "player",
      team: "ally",
      speed: 100,
      hp: 10,
      maxHp: 30,
      attackPower: 8,
      learnedSkills: [
        { skillId: "test-strike", type: "active", origin: "initial", acquisition: "initial" },
        { skillId: "test-heal", type: "active", origin: "initial", acquisition: "initial" },
      ],
    },
    { id: "slime", team: "enemy", speed: 40, hp: effect === "attack" ? 12 : 40, attackPower: 4 },
  ];
  const before = advanceBattleToNextAllyInput(createBattleState(definitions)).state;
  const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition };
  const committed = performBattleSkillAndAdvanceToAllyInput(
    before,
    "player",
    effect === "attack" ? "slime" : "player",
    effect === "attack" ? "test-strike" : "test-heal",
    rules.catalog,
    rules.fatigue,
  );
  if (!committed.accepted) throw new Error(committed.reason);
  const input: BattleInput = {
    battle: committed.state,
    rules,
    basicAttack: false,
    items: false,
    itemCount: 0,
    enemyDepths: [{ id: "slime", depth: 5 }],
  };
  const initial = reduceBattleModel(
    createBattleModel({ before, after: committed.state, events: committed.events }, 0),
    input,
    { type: "scene-ready", owner: 0 },
  ).state;
  const sample = (elapsedMs: number) =>
    reduceBattleModel(initial, input, { type: "playback", event: { type: "advance", elapsedMs } }).state;
  const times =
    effect === "attack"
      ? [
          { name: "actor", domMs: 60, gpuMs: 48 },
          { name: "impact", domMs: 300, gpuMs: 300 },
          { name: "result", domMs: 440, gpuMs: 432 },
          { name: "defeat", domMs: 900, gpuMs: 896 },
        ]
      : [
          { name: "heal-impact", domMs: 300, gpuMs: 300 },
          { name: "heal-result", domMs: 640, gpuMs: 640 },
        ];
  return {
    definitions,
    input,
    initial,
    samples: times.map((time) => ({ ...time, dom: sample(time.domMs), gpu: sample(time.gpuMs) })),
  };
}
