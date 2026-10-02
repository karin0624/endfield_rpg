import { describe, expect, it } from "vitest";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import type { BattleCombatantDefinition } from "./battle";
import {
  createDungeonState,
  type DungeonActionResult,
  type DungeonState,
  enterNextDungeonNode,
  performDungeonBranchSkill,
} from "./dungeon";
import { healthyStatus } from "./status";

const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition };
function initial(fatigue = 100, seed = 1, status = healthyStatus()): DungeonState {
  const actor: BattleCombatantDefinition = {
    id: "healer",
    team: "ally",
    hp: 20,
    maxHp: 200,
    attackPower: 8,
    speed: 10,
    mentalFatigue: fatigue,
    status,
    learnedSkills: [
      { type: "active", skillId: "test-heal", origin: "initial", acquisition: "initial" },
      { type: "active", skillId: "test-strike", origin: "initial", acquisition: "initial" },
    ],
  };
  return {
    ...createDungeonState(
      initialDungeon,
      initialAdventure,
      [actor, { ...actor, id: "target", hp: 1, maxHp: 1000 }],
      [],
      seed,
    ),
    expeditionActionId: 7,
  };
}
function input(state: DungeonState) {
  return {
    actorId: "healer",
    targetId: "target",
    skillId: "test-heal",
    expectedVersion: state.branchSkillVersion,
    expectedNodeId: state.currentNodeId,
    expeditionActionId: 7,
  };
}
function accepted(result: DungeonActionResult): Extract<DungeonActionResult, { accepted: true }> {
  if (!result.accepted) throw new Error(result.reason);
  return result;
}
function use(state: DungeonState) {
  return accepted(performDungeonBranchSkill(state, input(state), initialDungeon, rules));
}
describe("分岐でのHP回復", () => {
  it("今回と次回は別々の使用前疲労で計算し、再送は乱数も含めて不変", () => {
    const start = initial(100, 1000, { ...healthyStatus(), physicalFatigue: 200, haze: 200 });
    const first = use(start);
    expect(first.accepted).toBe(true);
    // maxHP floor(200/3)=66; base 8+33=41; fatigue 100 => 20.5.
    expect(first.state.party[1].hp).toBe(21.5);
    expect(first.state.party[0].mentalFatigue).toBe(103);
    const replay = performDungeonBranchSkill(first.state, input(start), initialDungeon, rules);
    expect(replay).toMatchObject({ accepted: false, state: first.state, events: [] });
    const second = use(first.state);
    expect(second.accepted).toBe(true);
    expect(second.state.party[1].hp).toBeCloseTo(41.69704433497537, 10);
    expect(second.state.party[0].mentalFatigue).toBe(106);
    expect(second.state.randomState).toBe(1000);
    expect(second.state).toMatchObject({
      currentNodeId: start.currentNodeId,
      resolvedNodeIds: start.resolvedNodeIds,
      flags: [],
      outcome: "ongoing",
    });
  });
  it("固定乱数で使用者だけに今回負荷3を発症させ、自己回復後に上限へ収める", () => {
    const start = initial();
    const first = use(start);
    expect(first.state.party[1].hp).toBe(55);
    expect(first.state.party[1].status).toEqual(healthyStatus());
    expect(first.state.party[0].status).toEqual({ ...healthyStatus(), physicalFatigue: 3 });
    expect(first.state.randomState).toBe(1586005467);
    const self = initial(100, 1);
    const full = { ...self, party: self.party.map((member) => ({ ...member, hp: 190 })) };
    const result = accepted(
      performDungeonBranchSkill(full, { ...input(full), targetId: "healer" }, initialDungeon, rules),
    );
    expect(result.events[0]).toMatchObject({ type: "skill", amount: 10 });
    expect(result.state.party[0].hp).toBe(194);
  });
  it("発症失敗と数値上限の候補除外を既存乱数で処理する", () => {
    const noOnset = use(initial(0));
    expect(noOnset.state.randomState).toBe(1015568748);
    expect(noOnset.state.party[0].status).toEqual(healthyStatus());
    const capped = use(initial(100, 1, { ...healthyStatus(), physicalFatigue: 200 }));
    expect(capped.state.party[0].status).toEqual({ ...healthyStatus(), physicalFatigue: 200, haze: 3 });
  });
  it.each([
    { actorId: "reserve" },
    { targetId: "reserve" },
    { skillId: "test-mend" },
    { skillId: "test-strike" },
    { expectedVersion: -1 },
    { expectedNodeId: "battle-a" },
    { expeditionActionId: 6 },
  ])("不正入力 %j はHP・疲労・症状・乱数を変えない", (patch) => {
    const start = initial();
    expect(performDungeonBranchSkill(start, { ...input(start), ...patch }, initialDungeon, rules)).toMatchObject({
      accepted: false,
      state: start,
      events: [],
    });
  });
  it.each(["healer", "target"])("HP0・参加不能の%sを拒否する", (id) => {
    for (const patch of [{ hp: 0 }, { status: { ...healthyStatus(), incapacityRecoverySteps: 6 } }]) {
      const state = initial();
      const blocked = {
        ...state,
        party: state.party.map((member) => (member.id === id ? { ...member, ...patch } : member)),
      };
      expect(performDungeonBranchSkill(blocked, input(blocked), initialDungeon, rules)).toMatchObject({
        accepted: false,
        state: blocked,
        events: [],
      });
    }
  });
  it("戦闘・会話・探索終了・別探索の古い入力を拒否する", () => {
    const start = initial();
    for (const node of ["battle-a", "conversation-b"]) {
      const entered = accepted(enterNextDungeonNode(start, node, initialDungeon, initialAdventure)).state;
      expect(performDungeonBranchSkill(entered, input(start), initialDungeon, rules)).toMatchObject({
        accepted: false,
        state: entered,
      });
    }
    for (const changed of [
      { ...start, outcome: "cleared" as const },
      { ...start, expeditionActionId: 8 },
    ])
      expect(performDungeonBranchSkill(changed, input(start), initialDungeon, rules)).toMatchObject({
        accepted: false,
        state: changed,
      });
  });
});

it("習得済み応急回復は既存定義を使い、負荷0の回復は減衰・乱数消費しない", () => {
  const start = initial(100);
  const learned = {
    ...start,
    party: start.party.map((member) => ({
      ...member,
      learnedSkills: [
        ...(member.learnedSkills ?? []),
        {
          type: "active" as const,
          skillId: "test-mend",
          origin: "expedition" as const,
          acquisition: "choice" as const,
        },
      ],
    })),
  };
  const mend = accepted(
    performDungeonBranchSkill(learned, { ...input(learned), skillId: "test-mend" }, initialDungeon, rules),
  );
  expect(mend.state.party[1].hp).toBe(32);
  expect(mend.state.party[0].mentalFatigue).toBe(101);
  expect(mend.state.party[0].status?.physicalFatigue).toBe(1);
  const noLoadRules = {
    ...rules,
    catalog: {
      ...rules.catalog,
      skills: rules.catalog.skills.map((skill) =>
        skill.id === "test-heal" ? { ...skill, mentalFatigueIncrease: 0 } : skill,
      ),
    },
  };
  const free = accepted(performDungeonBranchSkill(start, input(start), initialDungeon, noLoadRules));
  expect(free.state.party[1].hp).toBe(109);
  expect(free.state.party[0].mentalFatigue).toBe(100);
  expect(free.state.randomState).toBe(1);
  expect(free.state.party[0].status).toEqual(healthyStatus());
});
