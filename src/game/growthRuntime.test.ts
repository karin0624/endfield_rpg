import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { advanceBattleToNextAllyInput, createBattleState } from "./battle";
import { createInitialGameState } from "./createInitialGameState";
import {
  actInExpedition,
  actInTown,
  applyPartyStatus,
  beginTownExploration,
  departOnExpedition,
  type ExpeditionGame,
  editExpeditionParty,
  leaveExpedition,
  receiveTownRecoverySignal,
} from "./expedition";
import { chooseGrowthSkill, ensureGrowth, rewardGrowth } from "./growthRuntime";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";
import {
  chooseSkill,
  createExplorationSkills,
  type ExplorationSkills,
  grantSkillExperience,
  prepareSkillChoice,
} from "./skillAcquisition";

const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules };
function initial(joined = ["player"]): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, joined),
    dungeon: null,
  };
}
function accept<T>(result: { accepted: boolean; state: T }): T {
  expect(result.accepted).toBe(true);
  return result.state;
}
function depart(game: ExpeditionGame) {
  return accept(departOnExpedition(game, characters, initialDungeon, initialAdventure, rules));
}
function act(game: ExpeditionGame, command: Parameters<typeof actInExpedition>[1]) {
  const update = actInExpedition(game, command, initialDungeon, initialAdventure, rules);
  expect(update.result.accepted).toBe(true);
  return update.state;
}
function strike(game: ExpeditionGame, targetId: string) {
  const dungeon = game.dungeon;
  if (dungeon?.activity?.type !== "battle") throw new Error("戦闘がありません");
  return act(game, {
    type: "skill",
    actorId: "player",
    targetId,
    skillId: "test-strike",
    expectedNodeId: dungeon.activeNodeId ?? "",
    expectedActionTime: dungeon.activity.state.logicalTime,
    expeditionActionId: dungeon.expeditionActionId ?? -1,
  });
}
function selection(game: ExpeditionGame, preferred?: string) {
  const state = game.growth;
  const choice = state?.choice;
  if (!choice || !state) throw new Error("選択がありません");
  return {
    explorationId: state.explorationId,
    characterId: choice.characterId,
    level: choice.level,
    skillId: preferred && choice.candidateIds.includes(preferred) ? preferred : choice.candidateIds[0],
  };
}
function resolve(game: ExpeditionGame): ExpeditionGame {
  let current = game;
  while (current.growth?.choice) current = accept(chooseGrowthSkill(current, selection(current, "test-power"), rules));
  return current;
}
function town(game: ExpeditionGame) {
  const begun = accept(beginTownExploration(game, "market", initialAdventure));
  return accept(
    actInTown(
      begun,
      begun.clock?.pendingAction?.id ?? -1,
      { type: "advance" },
      characters,
      initialAdventure,
      mentalFatigueDefinition,
      rules,
    ),
  );
}
function roundTrip(game: ExpeditionGame) {
  const saved = serializeGame(game, saveDefinitions);
  if (!saved.accepted) throw new Error(saved.reason);
  const loaded = deserializeGame(saved.data, saveDefinitions);
  return accept(loaded.accepted ? loaded : { ...loaded, state: game });
}

describe("通常操作の成長と取得・帰還", () => {
  it("街XPを保存・持込み、勝利の各レベルを選び次戦へ反映し、最終ボスXP0から初期化する", () => {
    let game = roundTrip(town(initial()));
    expect(game.growth?.growth.characters[0]).toMatchObject({ level: 1, experience: 5 });
    game = town(game);
    expect(game.growth?.growth.characters[0].experience).toBe(5);
    game = depart(game);
    game = act(game, { type: "enter", nodeId: "battle-a" });
    game = strike(game, "slime");
    const beforeHp = game.party.members[0].hp;
    game = strike(game, "slime-2");
    expect(game.growth?.growth.characters[0]).toMatchObject({
      level: 4,
      experience: 0,
      pendingChoiceLevels: [2, 3, 4],
      bonus: { maxHp: 12, attackPower: 3 },
    });
    expect(game.party.members[0].hp).toBe(beforeHp + 12);
    const stale = selection(game);
    expect(
      actInExpedition(game, { type: "enter", nodeId: "boss-c" }, initialDungeon, initialAdventure, rules).result,
    ).toMatchObject({ accepted: false, reason: "pending-growth-choice" });
    expect(leaveExpedition(game, undefined, rules).accepted).toBe(false);
    expect(editExpeditionParty(game, 0, null).accepted).toBe(false);
    expect(beginTownExploration(game, "market", initialAdventure).accepted).toBe(false);
    expect(serializeGame(game, saveDefinitions).accepted).toBe(false);
    expect(prepareSkillChoice(game.growth as ExplorationSkills, skillCatalog)).toEqual(game.growth);
    game = resolve(game);
    expect(chooseGrowthSkill(game, stale, rules).accepted).toBe(false);
    const power = game.dungeon?.party[0].attackPower;
    expect(power).toBeGreaterThanOrEqual(11);
    game = act(game, { type: "enter", nodeId: "boss-c" });
    if (game.dungeon?.activity?.type !== "battle") throw new Error("戦闘なし");
    expect(game.dungeon.activity.state.combatants.find(({ id }) => id === "player")).toMatchObject({
      attackPower: power,
      maxHp: 36,
    });
    const xp = game.growth?.growth.characters[0].experience;
    while (game.dungeon?.activity?.type === "battle") game = strike(game, "ruin-warden");
    expect(game.dungeon?.outcome).toBe("cleared");
    expect(game.growth?.growth.characters[0].experience).toBe(xp);
    expect(game.growth?.choice).toBeNull();
    const fatigue = game.party.members[0].mentalFatigue;
    game = accept(leaveExpedition(game, undefined, rules));
    expect(game.party.members[0]).toMatchObject({ hp: 20, mentalFatigue: fatigue });
    expect(game.growth?.growth.characters[0]).toMatchObject({
      level: 1,
      experience: 0,
      bonus: { maxHp: 0, attackPower: 0 },
    });
    expect(game.growth?.characters[0].learned.map(({ skillId }) => skillId)).toEqual(["test-strike", "test-heal"]);
    game = roundTrip(game);
    expect(chooseGrowthSkill(game, stale, rules).accepted).toBe(false);
    game = depart(game);
    expect(chooseGrowthSkill(game, stale, rules).accepted).toBe(false);
    expect(game.dungeon?.party[0]).toMatchObject({ maxHp: 20, attackPower: 8 });
  });
  it("余剰XP・報酬再送・HP差分を保持し、控えの育成も帰還で消す", () => {
    let game = ensureGrowth(initial(["player", "gilberta"]), rules);
    game = applyPartyStatus(game, "gilberta", { kind: "haze", amount: 10 }, characters);
    const reward = { id: "event:reserve", allocations: [{ characterId: "gilberta", experience: 25 }] };
    game = accept(rewardGrowth(game, reward, rules));
    expect(game.growth?.growth.characters[1]).toMatchObject({ level: 3, experience: 5 });
    game = resolve(game);
    expect(rewardGrowth(game, reward, rules)).toMatchObject({
      accepted: false,
      state: game,
      reason: "reward-already-applied",
    });
    game = roundTrip(game);
    game = depart(game);
    game = accept(leaveExpedition(game, undefined, rules));
    expect(game.growth?.growth.characters[1]).toMatchObject({ level: 1, experience: 0 });
    expect(game.party.members[1]).toMatchObject({ hp: 18, status: { haze: 10 } });
  });
  it("敗北は直ちに帰還しHPを回復しても戦闘不能・疲労を残す", () => {
    let game = initial();
    game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 200 }, characters);
    game = depart(game);
    game = act(game, { type: "enter", nodeId: "battle-a" });
    while (game.dungeon?.activity?.type === "battle") {
      const battle = game.dungeon.activity.state;
      const target = battle.combatants.find((member) => member.team === "enemy" && member.isAlive);
      if (!target) throw new Error("敵なし");
      game = act(game, { type: "attack", actorId: "player", targetId: target.id });
    }
    expect(game.dungeon).toBeNull();
    expect(game.party.members[0]).toMatchObject({
      hp: 6,
      status: { physicalFatigue: 200, incapacityRecoverySteps: 6 },
    });
    expect(game.growth?.growth.characters[0]).toMatchObject({ level: 1, experience: 0 });
    expect(game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0 });
    expect(roundTrip(game).party.members[0]).toEqual(game.party.members[0]);
  });
  it("HP0／参加不能は成長投影で復活せず、勝利XPは生存出撃者に同額", () => {
    let game = initial(["player", "gilberta"]);
    game = applyPartyStatus(game, "gilberta", { kind: "incapacity" }, characters);
    game = accept(editExpeditionParty(game, 1, "gilberta"));
    game = depart(game);
    game = act(game, { type: "enter", nodeId: "battle-a" });
    game = strike(game, "slime");
    game = strike(game, "slime-2");
    expect(game.growth?.growth.characters.map(({ level, experience }) => [level, experience])).toEqual([
      [3, 5],
      [1, 0],
    ]);
    expect(game.party.members[1].status?.incapacityRecoverySteps).toBe(6);
  });
  it("試用の全候補採用経路で最大3権利を常に3択で完了できる", () => {
    const paths = new Set<string>();
    function visit(state: ExplorationSkills, path: readonly string[]): void {
      const choice = state.choice;
      if (!choice) {
        paths.add(path.join(","));
        return;
      }
      expect(choice.status).toBe("offered");
      expect(new Set(choice.candidateIds).size).toBe(3);
      for (const skillId of choice.candidateIds) {
        visit(
          accept(
            chooseSkill(
              state,
              { explorationId: "trial", characterId: "player", level: choice.level, skillId },
              skillCatalog,
            ),
          ),
          [...path, skillId],
        );
      }
    }
    for (let seed = 0; seed < 1024; seed++) {
      const start = createExplorationSkills("trial", seed, growthRules.progression, skillCatalog);
      visit(
        accept(
          grantSkillExperience(
            start,
            "trial",
            { id: "budget", allocations: [{ characterId: "player", experience: 30 }] },
            growthRules.progression,
            skillCatalog,
          ),
        ),
        [],
      );
    }
    // 5^3 sequences minus the two one-use actives' 13 repetitions each,
    // minus the two two-rank passives' triple selections = 97 legal paths.
    expect(paths.size).toBe(97);
  });
});

type MutableSaveFixture = {
  randomState: number;
  growth: {
    randomState: number;
    closed: boolean;
    growth: { characters: { experience: number; bonus: { maxHp: number }; pendingChoiceLevels: number[] }[] };
    characters: { learned: { rank?: number }[] }[];
  };
};

describe("成長保存の入力検証", () => {
  it("不正な乱数・余剰・補正・習得ランク・残存権利を例外なく拒否する", () => {
    const saved = serializeGame(town(initial()), saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    for (const mutate of [
      (data: MutableSaveFixture) => {
        data.randomState = -1;
        data.growth.randomState = -1;
      },
      (data: MutableSaveFixture) => {
        data.randomState = 0.5;
        data.growth.randomState = 0.5;
      },
      (data: MutableSaveFixture) => {
        data.randomState = 0x100000000;
        data.growth.randomState = 0x100000000;
      },
      (data: MutableSaveFixture) => {
        data.growth.growth.characters[0].experience = 10;
      },
      (data: MutableSaveFixture) => {
        data.growth.growth.characters[0].bonus.maxHp = 4;
      },
      (data: MutableSaveFixture) => {
        data.growth.characters[0].learned[0].rank = 2;
      },
      (data: MutableSaveFixture) => {
        data.growth.growth.characters[0].pendingChoiceLevels = [2];
      },
      (data: MutableSaveFixture) => {
        data.growth.closed = true;
      },
    ]) {
      const data = JSON.parse(saved.data);
      mutate(data);
      expect(deserializeGame(JSON.stringify(data), saveDefinitions)).toEqual({
        accepted: false,
        reason: "invalid-data",
      });
    }
  });
  it("旧形式を非対応とし現在の保存内容を変換しない", () => {
    const saved = serializeGame(initial(), saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    const payload = JSON.parse(saved.data);
    payload.version = 2;
    delete payload.growth;
    const original = JSON.stringify(payload);
    expect(deserializeGame(original, saveDefinitions)).toEqual({ accepted: false, reason: "unsupported-version" });
    expect(JSON.stringify(payload)).toBe(original);
  });
});

describe("生存条件とパッシブ効果", () => {
  it("生存出撃メンバーへ同額を渡し控えには渡さない", () => {
    let game = accept(editExpeditionParty(initial(["player", "gilberta"]), 1, "gilberta"));
    game = depart(game);
    game = act(game, { type: "enter", nodeId: "battle-a" });
    while (game.dungeon?.activity?.type === "battle") {
      const battle = game.dungeon.activity.state;
      const actor = battle.combatants.find(({ id }) => id === battle.currentActorId);
      const target = battle.combatants.find((member) => member.team === "enemy" && member.isAlive);
      if (!actor || !target) throw new Error("戦闘入力なし");
      game = act(game, { type: "attack", actorId: actor.id, targetId: target.id });
    }
    expect(game.growth?.growth.characters.map(({ level, experience }) => [level, experience])).toEqual([
      [3, 5],
      [3, 5],
    ]);
    game = resolve(game);
    expect(game.growth?.growth.characters.every(({ pendingChoiceLevels }) => pendingChoiceLevels.length === 0)).toBe(
      true,
    );
  });
});

describe("HP上限の差分", () => {
  it("体力の習得とランク増加だけ現在HPへ加え、症状・疲労を維持する", () => {
    let injured = applyPartyStatus(initial(), "player", { kind: "physicalFatigue", amount: 10 }, characters);
    injured = receiveTownRecoverySignal(injured, 0, characters, mentalFatigueDefinition);
    injured = applyPartyStatus(injured, "player", { kind: "haze", amount: 10 }, characters);
    let verified = false;
    for (let seed = 0; seed < 128 && !verified; seed++) {
      let game = accept(
        rewardGrowth(
          { ...injured, randomState: seed },
          { id: "event", allocations: [{ characterId: "player", experience: 25 }] },
          rules,
        ),
      );
      expect(game.party.members[0].hp).toBe(26); // 18 injured HP + 8 level growth, not full28.
      if (!game.growth?.choice?.candidateIds.includes("test-vitality")) continue;
      game = accept(chooseGrowthSkill(game, selection(game, "test-vitality"), rules));
      expect(game.party.members[0].hp).toBe(30);
      if (!game.growth?.choice?.candidateIds.includes("test-vitality")) continue;
      game = accept(chooseGrowthSkill(game, selection(game, "test-vitality"), rules));
      expect(game.party.members[0]).toMatchObject({ hp: 33, status: { haze: 10 }, mentalFatigue: 0 });
      game = roundTrip(game);
      game = depart(game);
      expect(game.dungeon?.party[0]).toMatchObject({ hp: 33, maxHp: 35 });
      game = accept(leaveExpedition(game, undefined, rules));
      expect(game.party.members[0]).toMatchObject({ hp: 20, status: { haze: 10 } });
      verified = true;
    }
    expect(verified).toBe(true);
  });
  it("戦闘でHP0になったキャラを成長投影で復活させない", () => {
    const battle = advanceBattleToNextAllyInput(
      createBattleState([
        { ...characters[0], team: "ally", hp: 1 },
        { id: "enemy", team: "enemy", hp: 20, attackPower: 10, speed: 1000 },
      ]),
    ).state;
    const fallen = battle.combatants.find(({ id }) => id === "player");
    if (!fallen) throw new Error("戦闘参加者なし");
    expect(fallen.hp).toBe(0);
    const game = {
      ...initial(),
      party: {
        ...initial().party,
        members: [{ id: fallen.id, hp: fallen.hp, status: fallen.status, mentalFatigue: fallen.mentalFatigue }],
      },
    };
    const growth = accept(
      rewardGrowth(
        game,
        { id: "explicit-core-fixture", allocations: [{ characterId: "player", experience: 10 }] },
        rules,
      ),
    );
    expect(growth.party.members[0]).toMatchObject({ hp: 0, status: { incapacityRecoverySteps: 6 } });
  });
});
