import { describe, expect, it, onTestFailed } from "vitest";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { validateContent } from "../content/validateContent";
import { createInitialGameState } from "./createInitialGameState";
import {
  actInExpedition,
  actInTown,
  beginTownExploration,
  type DungeonCommand,
  departOnExpedition,
  type ExpeditionGame,
  editExpeditionParty,
  leaveExpedition,
  receiveTownRecoverySignal,
} from "./expedition";
import { chooseGrowthSkill } from "./growthRuntime";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";
import { prepareSkillChoice } from "./skillAcquisition";
import { multidayFixture } from "./testing/multidayFixture";

describe("Issue46: 公開操作による複数日受入", () => {
  it.each(["cleared", "failed"] as const)("加入・4枠と控え・育成・回復・%s帰還・保存・再出撃", (outcome) => {
    const definitions = multidayFixture(outcome);
    validateContent(definitions);
    const { characters, adventure, dungeon, save } = definitions;
    const rules = { catalog: definitions.skills, growth: definitions.growth, fatigue: mentalFatigueDefinition };
    const operations: unknown[] = [];
    let game: ExpeditionGame = {
      adventure: createInitialGameState(definitions.initial),
      party: createParty(characters, ["player"]),
      dungeon: null,
      randomState: 3,
    };
    onTestFailed(() => console.error(JSON.stringify({ seed: 3, definitions, operations, state: game }, null, 2)));
    function accept(result: { accepted: boolean; state: ExpeditionGame }) {
      expect(result.accepted).toBe(true);
      game = result.state;
    }
    function act(command: DungeonCommand) {
      operations.push(command);
      const update = actInExpedition(game, command, dungeon, adventure, rules);
      expect(update.result.accepted).toBe(true);
      game = update.state;
      return update;
    }
    function reject(command: DungeonCommand) {
      operations.push({ rejected: command });
      expect(actInExpedition(game, command, dungeon, adventure, rules)).toMatchObject({
        state: game,
        result: { accepted: false },
      });
    }
    function town(place = "market") {
      operations.push({ town: place });
      accept(beginTownExploration(game, place, adventure));
      const id = game.clock?.pendingAction?.id ?? -1;
      accept(actInTown(game, id, { type: "advance" }, characters, adventure, mentalFatigueDefinition, rules));
      expect(
        actInTown(game, id, { type: "advance" }, characters, adventure, mentalFatigueDefinition, rules),
      ).toMatchObject({ accepted: false, state: game });
      return id;
    }
    function selection() {
      const choice = game.growth?.choice;
      if (!choice || !game.growth) throw new Error("必須選択なし");
      const skillId = choice.level === 2 ? "test-strength" : choice.level === 3 ? "test-power" : "test-vitality";
      return {
        explorationId: game.growth.explorationId,
        characterId: choice.characterId,
        level: choice.level,
        skillId,
      };
    }
    function resolve() {
      for (let count = 0; game.growth?.choice && count < 20; count++) {
        expect(game.growth.choice.status).toBe("offered");
        expect(new Set(game.growth.choice.candidateIds)).toEqual(
          new Set(["test-strength", "test-power", "test-vitality"]),
        );
        expect(prepareSkillChoice(game.growth, rules.catalog)).toEqual(game.growth);
        const command = selection();
        operations.push({ choose: command });
        accept(chooseGrowthSkill(game, command, rules));
        expect(chooseGrowthSkill(game, command, rules)).toMatchObject({ accepted: false, state: game });
      }
      expect(game.growth?.choice).toBeNull();
    }
    function roundTrip() {
      operations.push("v4 round-trip twice");
      for (let i = 0; i < 2; i++) {
        const written = serializeGame(game, save);
        if (!written.accepted) throw new Error(written.reason);
        expect(JSON.parse(written.data).version).toBe(5);
        const read = deserializeGame(written.data, save);
        if (!read.accepted) throw new Error(read.reason);
        expect(read.state).toMatchObject({
          adventure: game.adventure,
          party: game.party,
          clock: game.clock,
          randomState: game.randomState,
          lastTownRecoverySignal: game.lastTownRecoverySignal,
          growth: {
            growth: game.growth?.growth,
            characters: game.growth?.characters,
            choice: game.growth?.choice,
            closed: game.growth?.closed,
          },
        });
        const rewritten = serializeGame(read.state, save);
        expect(rewritten).toEqual(written);
        game = read.state;
      }
    }
    function depart() {
      operations.push("depart");
      accept(departOnExpedition(game, characters, dungeon, adventure, rules));
    }
    function heal(): Extract<DungeonCommand, { type: "branch-skill" }> {
      return {
        type: "branch-skill",
        actorId: "player",
        targetId: "player",
        skillId: "test-heal",
        expectedVersion: game.dungeon?.branchSkillVersion ?? -1,
        expectedNodeId: game.dungeon?.currentNodeId ?? "",
        expeditionActionId: game.dungeon?.expeditionActionId ?? -1,
      };
    }
    const recruitAction = town("recruit");
    expect(game.party.members.map(({ id }) => id)).toEqual(["player", "a", "b", "c", "reserve"]);
    expect(game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    const oldTownChoice = selection();
    resolve();
    // All five gained Lv2 and a passive through the actual town reward, including the reserve.
    expect(game.growth?.growth.characters.map(({ level, experience }) => [level, experience])).toEqual([
      [2, 0],
      [2, 0],
      [2, 0],
      [2, 0],
      [2, 0],
    ]);
    for (const [slot, id] of ["a", "b", "c"].entries()) {
      operations.push({ editSlot: slot + 1, id });
      accept(editExpeditionParty(game, slot + 1, id));
    }
    expect(editExpeditionParty(game, 3, "player")).toMatchObject({ accepted: false, state: game });
    town("recruit");
    expect(game.party.members).toHaveLength(5);
    expect(game.growth?.growth.characters.map(({ experience }) => experience)).toEqual([0, 0, 0, 0, 0]);
    roundTrip();
    depart();
    const oldBranch = heal();
    act({ type: "enter", nodeId: "fight" });
    expect(game.party.members[0].hp).toBe(14); // 200 + town growth4 - enemy190.
    act({ type: "attack", actorId: "player", targetId: "enemy" });
    expect(game.growth?.growth.characters.map(({ level, experience }) => [level, experience])).toEqual([
      [4, 5],
      [4, 5],
      [4, 5],
      [4, 5],
      [2, 0],
    ]);
    const oldBattleChoice = selection();
    reject(heal());
    reject({ type: "enter", nodeId: "boss" });
    resolve();
    expect(game.party.members[0].hp).toBe(26); // Two levels +8 and vitality +4, no free full heal.
    expect(game.randomState).toBe(2885962492); // Seed3, thirteen offers, three draws each.
    reject(oldBranch);
    reject({ ...heal(), targetId: "reserve" });
    const first = heal();
    const healed = act(first);
    expect(healed.result.events).toMatchObject([
      { type: "skill", amount: expect.closeTo(18.8, 10), fatigueBefore: 0, fatigueAfter: 50 },
      { type: "symptom", kind: "physicalFatigue", before: 0, after: 50 },
    ]); // (8 + 216*.05) before onset; first two draws .00444, .42273.
    expect(game.party.members[0]).toMatchObject({
      hp: expect.closeTo(44.8, 10),
      mentalFatigue: 50,
      status: { physicalFatigue: 50, haze: 0 },
    });
    expect(game.randomState).toBe(1815624078);
    reject(first);
    const second = act(heal()); // A fresh version intentionally repeats the use.
    expect(second.result.events).toMatchObject([
      { type: "skill", amount: expect.closeTo(10.133333333333333, 10), fatigueBefore: 50, fatigueAfter: 100 },
    ]);
    expect(second.result.events).toHaveLength(1); // .75425 >= p(100)=.5, no onset.
    expect(game.party.members[0].hp).toBeCloseTo(54.93333333333333, 10);
    expect(game.randomState).toBe(3239474069);
    expect(game.clock).toMatchObject({ elapsedHalfDays: 2, recoverySteps: 2 });
    const expeditionId = game.clock?.pendingAction?.id;
    const lastBranch = heal();
    act({ type: "enter", nodeId: "boss" });
    if (outcome === "cleared") {
      if (game.dungeon?.activity?.type !== "battle") throw new Error("次戦なし");
      expect(game.dungeon.activity.state.combatants[0]).toMatchObject({
        attackPower: 25,
        basicAttackBonus: 2,
        mentalFatigue: 100,
      });
      const hit = act({
        type: "skill",
        actorId: "player",
        targetId: "boss-enemy",
        skillId: "test-light-strike",
        expectedNodeId: "boss",
        expectedActionTime: game.dungeon.activity.state.logicalTime,
        expeditionActionId: expeditionId ?? -1,
      });
      expect(hit.result.events[0]).toMatchObject({
        type: "skill",
        amount: 37.5,
        fatigueBefore: 100,
        fatigueAfter: 100,
      });
      act({ type: "attack", actorId: "a", targetId: "boss-enemy" });
      expect(game.dungeon?.outcome).toBe("cleared");
      expect(game.growth?.growth.characters.map(({ experience }) => experience)).toEqual([5, 5, 5, 5, 0]);
      expect(game.growth?.choice).toBeNull();
      operations.push({ return: expeditionId });
      accept(leaveExpedition(game, expeditionId, rules));
    }
    expect(game.dungeon).toBeNull();
    expect(game.clock).toMatchObject({ elapsedHalfDays: 3, recoverySteps: 2 });
    expect(game.party.members[0]).toMatchObject({
      hp: 133,
      mentalFatigue: 100,
      status: { physicalFatigue: 50, haze: 0, incapacityRecoverySteps: outcome === "failed" ? 6 : null },
    });
    expect(game.party.slots).toEqual(["player", "a", "b", "c"]);
    expect(game.adventure.flags).toEqual(["joined-a", "joined-b", "joined-c", "joined-reserve"]);
    for (const growth of game.growth?.growth.characters ?? [])
      expect(growth).toMatchObject({
        level: 1,
        experience: 0,
        bonus: { maxHp: 0, attackPower: 0 },
        pendingChoiceLevels: [],
      });
    for (const member of game.growth?.characters ?? [])
      expect(member.learned.map(({ skillId }) => skillId)).toEqual(["test-heal"]);
    expect(game.party.members[4]).toMatchObject({ hp: 200 });
    expect(game.randomState).toBe(3239474069);
    expect(leaveExpedition(game, expeditionId, rules)).toMatchObject({ accepted: false, state: game });
    reject(lastBranch);
    roundTrip();
    expect(chooseGrowthSkill(game, oldTownChoice, rules)).toMatchObject({ accepted: false, state: game });
    expect(chooseGrowthSkill(game, oldBattleChoice, rules)).toMatchObject({ accepted: false, state: game });
    expect(
      actInTown(game, recruitAction, { type: "advance" }, characters, adventure, mentalFatigueDefinition, rules),
    ).toMatchObject({ accepted: false, state: game });
    for (let step = 1; step <= (outcome === "failed" ? 6 : 1); step++) {
      town();
      resolve();
      expect(game.party.members[0]).toMatchObject({
        mentalFatigue: 100 - step * 10,
        status: {
          physicalFatigue: Math.max(0, 50 - step * 10),
          incapacityRecoverySteps: outcome === "failed" && step < 6 ? 6 - step : null,
        },
      });
      if (outcome === "failed")
        expect(departOnExpedition(game, characters, dungeon, adventure, rules).accepted).toBe(step === 6);
      operations.push({ repeatRecoverySignal: game.lastTownRecoverySignal });
      const before = game;
      game = receiveTownRecoverySignal(game, game.lastTownRecoverySignal ?? -1, characters, mentalFatigueDefinition);
      expect(game).toEqual(before);
      roundTrip();
    }
    expect(game.clock).toMatchObject({
      elapsedHalfDays: outcome === "failed" ? 9 : 4,
      recoverySteps: outcome === "failed" ? 8 : 3,
    });
    depart();
    reject(lastBranch);
    expect(chooseGrowthSkill(game, oldBattleChoice, rules)).toMatchObject({ accepted: false, state: game });
    expect(game.dungeon?.party[0]).toMatchObject({
      attackPower: outcome === "failed" ? 20 : 21,
      basicAttackBonus: outcome === "failed" ? 0 : 2,
    });
    expect(game.growth?.characters[0].learned.some(({ skillId }) => skillId === "test-light-strike")).toBe(false);
    if (outcome === "cleared") {
      // Symptoms50 -> town40 -> expedition40 -> town30. Only two of these three half-days heal.
      expect(game.party.members[0].status?.physicalFatigue).toBe(40);
      operations.push({ return: game.clock?.pendingAction?.id });
      accept(leaveExpedition(game, undefined, rules));
      expect(game.party.members[0]).toMatchObject({ hp: 142, mentalFatigue: 90, status: { physicalFatigue: 40 } });
      town();
      resolve();
      expect(game.party.members[0]).toMatchObject({ hp: 145, mentalFatigue: 80, status: { physicalFatigue: 30 } });
      // HP142 + new session level-up3; symptom recovery itself does not add HP.
      expect(game.clock).toMatchObject({ elapsedHalfDays: 6, recoverySteps: 4 });
      roundTrip();
    }
  });
});

it.each([3, 1500])("現行保存を繰返し読んでもseed%sの命中と安定候補を再現する", (seed) => {
  const fixture = multidayFixture("cleared");
  const characters = fixture.characters.map((character) => ({ ...character, hitRate: 0.8 }));
  const growth = { ...fixture.growth, characters };
  const rules = { catalog: fixture.skills, growth, fatigue: mentalFatigueDefinition };
  const save = { ...fixture.save, characters, skills: rules };
  validateContent({ ...fixture, characters, growth, save });
  const initial: ExpeditionGame = {
    adventure: createInitialGameState(fixture.initial),
    party: createParty(characters, ["player"]),
    dungeon: null,
    randomState: seed,
  };
  let lastState = initial;
  onTestFailed(() =>
    console.error(
      JSON.stringify(
        {
          seed,
          definitions: { ...fixture, characters, growth, save },
          operations: ["v4 save/read", "depart", "enter fight", "player attacks enemy"],
          state: lastState,
        },
        null,
        2,
      ),
    ),
  );
  const written = serializeGame(initial, save);
  if (!written.accepted) throw new Error(written.reason);
  // Each fresh reader consumes the same immutable save and the same public inputs.
  // Both repetitions must satisfy independent numbers, not merely agree with each other.
  for (let repeat = 0; repeat < 2; repeat++) {
    const restored = deserializeGame(written.data, save);
    if (!restored.accepted) throw new Error(restored.reason);
    const departed = departOnExpedition(restored.state, characters, fixture.dungeon, fixture.adventure, rules);
    expect(departed.accepted).toBe(true);
    const entered = actInExpedition(
      departed.state,
      { type: "enter", nodeId: "fight" },
      fixture.dungeon,
      fixture.adventure,
      rules,
    );
    lastState = entered.state;
    expect(entered.result.accepted).toBe(true);
    expect(entered.state.party.members[0].hp).toBe(10);
    const result = actInExpedition(
      entered.state,
      { type: "attack", actorId: "player", targetId: "enemy" },
      fixture.dungeon,
      fixture.adventure,
      rules,
    );
    lastState = result.state;
    expect(result.result.accepted).toBe(true);
    if (seed === 3) {
      expect(result.state.party.members[0].hp).toBe(18);
      expect(result.state.growth?.choice).toMatchObject({
        characterId: "player",
        level: 2,
        candidateIds: ["test-power", "test-vitality", "test-strength"],
      });
      expect(result.state.randomState).toBe(3345418727);
      expect(result.state.clock).toMatchObject({ elapsedHalfDays: 0, recoverySteps: 0 });
    } else {
      expect(result.state.dungeon).toBeNull();
      expect(result.state.party.members[0]).toMatchObject({ hp: 200, status: { incapacityRecoverySteps: 6 } });
      expect(result.state.growth?.choice).toBeNull();
      expect(result.state.randomState).toBe(3510691723);
      expect(result.state.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0 });
    }
  }
});
