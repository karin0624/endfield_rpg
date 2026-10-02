import { describe, expect, it } from "vitest";

import {
  advanceBattleToNextActor,
  advanceBattleToNextAllyInput,
  type BattleCombatantDefinition,
  createBattleState,
  getBattleUpcomingActions,
  performBasicAttack,
  performBasicAttackAndAdvanceToAllyInput,
} from "./battle";

const definitions: readonly BattleCombatantDefinition[] = [
  {
    id: "hero",
    team: "ally",
    speed: 100,
    hp: 20,
    attackPower: 8,
  },
  {
    id: "companion",
    team: "ally",
    speed: 50,
    hp: 15,
    attackPower: 4,
  },
  {
    id: "slime",
    team: "enemy",
    speed: 40,
    hp: 12,
    attackPower: 3,
  },
];

function stateWithHeroActing() {
  return advanceBattleToNextActor(createBattleState(definitions));
}

describe("battle", () => {
  it("指定した敵だけに攻撃力分の固定ダメージを与え、継続時は次の行動者へ進める", () => {
    const state = stateWithHeroActing();
    const result = performBasicAttack(state, "hero", "slime");

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.events).toEqual([
      {
        type: "attack",
        actorId: "hero",
        targetId: "slime",
        damage: 8,
        targetHpBefore: 12,
        targetHpAfter: 4,
      },
    ]);
    expect(Object.fromEntries(result.state.combatants.map(({ id, hp }) => [id, hp]))).toEqual({
      hero: 20,
      companion: 15,
      slime: 4,
    });
    expect(result.state.currentActorId).toBe("hero");
    expect(result.state.outcome).toBe("ongoing");
    expect(getBattleUpcomingActions(result.state, 1)).toEqual([{ id: "hero", time: 200 }]);
  });

  it("HPを0未満にせず、倒れた敵を行動順から除外する", () => {
    const state = advanceBattleToNextActor(
      createBattleState([
        ...definitions.map((definition) => (definition.id === "slime" ? { ...definition, hp: 5 } : definition)),
        {
          id: "other-slime",
          team: "enemy",
          speed: 30,
          hp: 20,
          attackPower: 2,
        },
      ]),
    );
    const result = performBasicAttack(state, "hero", "slime");

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.events).toEqual([
      {
        type: "attack",
        actorId: "hero",
        targetId: "slime",
        damage: 8,
        targetHpBefore: 5,
        targetHpAfter: 0,
      },
      { type: "combatant-defeated", combatantId: "slime" },
    ]);
    expect(result.state.combatants).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "slime", hp: 0, isAlive: false })]),
    );
    expect(getBattleUpcomingActions(result.state, 12)).not.toContainEqual({
      id: "slime",
      time: expect.any(Number),
    });
  });

  it("最後の敵が倒れた時点で勝利し、勝敗イベントを一度だけ返す", () => {
    const state = advanceBattleToNextActor(
      createBattleState(
        definitions.map((definition) => (definition.id === "slime" ? { ...definition, hp: 8 } : definition)),
      ),
    );
    const result = performBasicAttack(state, "hero", "slime");

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.state.outcome).toBe("victory");
    expect(result.state.currentActorId).toBeNull();
    expect(result.events).toEqual([
      expect.objectContaining({ type: "attack" }),
      { type: "combatant-defeated", combatantId: "slime" },
      { type: "battle-ended", outcome: "victory" },
    ]);

    const afterEnd = performBasicAttack(result.state, "hero", "slime");
    expect(afterEnd).toEqual({
      accepted: false,
      reason: "battle-ended",
      state: result.state,
      events: [],
    });
  });

  it("最後の味方が倒れた時点で敗北する", () => {
    const state = advanceBattleToNextActor(
      createBattleState([
        {
          id: "hero",
          team: "ally",
          speed: 100,
          hp: 5,
          attackPower: 1,
        },
        {
          id: "slime",
          team: "enemy",
          speed: 99,
          hp: 20,
          attackPower: 8,
        },
      ]),
    );
    const heroResult = performBasicAttack(state, "hero", "slime");
    expect(heroResult.accepted).toBe(true);
    if (!heroResult.accepted) {
      return;
    }
    const result = performBasicAttack(heroResult.state, "slime", "hero");

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.state.outcome).toBe("defeat");
    expect(result.events.at(-1)).toEqual({
      type: "battle-ended",
      outcome: "defeat",
    });
  });

  it("行動順外・不正対象・味方対象は状態を変えずに拒否する", () => {
    const state = stateWithHeroActing();
    const before = structuredClone(state);

    expect(performBasicAttack(state, "companion", "slime")).toEqual({
      accepted: false,
      reason: "actor-is-not-current",
      state,
      events: [],
    });
    expect(performBasicAttack(state, "hero", "missing")).toEqual({
      accepted: false,
      reason: "target-does-not-exist",
      state,
      events: [],
    });
    expect(performBasicAttack(state, "hero", "companion")).toEqual({
      accepted: false,
      reason: "target-is-ally",
      state,
      events: [],
    });
    expect(state).toEqual(before);
  });

  it("戦闘不能の対象への追加入力を拒否する", () => {
    const state = advanceBattleToNextActor(
      createBattleState([
        ...definitions,
        {
          id: "dead-slime",
          team: "enemy",
          speed: 30,
          hp: 0,
          attackPower: 3,
        },
      ]),
    );

    expect(performBasicAttack(state, "hero", "dead-slime")).toEqual({
      accepted: false,
      reason: "target-is-defeated",
      state,
      events: [],
    });
  });

  it("HP0の初期戦闘者から勝敗を一意に決める", () => {
    const victory = createBattleState([
      {
        id: "hero",
        team: "ally",
        speed: 100,
        hp: 10,
        attackPower: 2,
      },
      {
        id: "defeated-enemy",
        team: "enemy",
        speed: 50,
        hp: 0,
        attackPower: 2,
      },
    ]);
    const defeat = createBattleState([
      {
        id: "defeated-ally",
        team: "ally",
        speed: 100,
        hp: 0,
        attackPower: 2,
      },
      {
        id: "slime",
        team: "enemy",
        speed: 50,
        hp: 10,
        attackPower: 2,
      },
    ]);

    expect(victory.outcome).toBe("victory");
    expect(victory.combatants.find(({ id }) => id === "defeated-enemy")?.isAlive).toBe(false);
    expect(defeat.outcome).toBe("defeat");
    expect(defeat.combatants.find(({ id }) => id === "defeated-ally")?.isAlive).toBe(false);
  });

  it("HPと攻撃力の不正な定義値を拒否する", () => {
    expect(() => createBattleState([{ ...definitions[0], hp: -1 }, definitions[2]])).toThrow("HP");
    expect(() => createBattleState([{ ...definitions[0], attackPower: Number.NaN }, definitions[2]])).toThrow("攻撃力");
  });

  it("開始時と味方の行動後に、連続する敵ターンを同期して解決する", () => {
    const loopDefinitions: readonly BattleCombatantDefinition[] = [
      { id: "hero", team: "ally", speed: 100, hp: 20, attackPower: 1 },
      { id: "companion", team: "ally", speed: 60, hp: 20, attackPower: 1 },
      { id: "first-enemy", team: "enemy", speed: 80, hp: 20, attackPower: 3 },
      { id: "second-enemy", team: "enemy", speed: 70, hp: 20, attackPower: 2 },
    ];
    const opening = advanceBattleToNextAllyInput(createBattleState(loopDefinitions));
    expect(opening.events).toEqual([]);
    expect(opening.state.currentActorId).toBe("hero");

    const heroAction = performBasicAttack(opening.state, "hero", "first-enemy");
    expect(heroAction.accepted).toBe(true);
    if (!heroAction.accepted) return;
    const afterCompanion = advanceBattleToNextAllyInput(heroAction.state);
    expect(afterCompanion.state.currentActorId).toBe("companion");
    expect(afterCompanion.events).toEqual([
      expect.objectContaining({ type: "attack", actorId: "first-enemy", targetId: "hero" }),
      expect.objectContaining({ type: "attack", actorId: "second-enemy", targetId: "hero" }),
    ]);

    const companionAction = performBasicAttack(afterCompanion.state, "companion", "first-enemy");
    expect(companionAction.accepted).toBe(true);
    if (!companionAction.accepted) return;
    const enemyTurns = advanceBattleToNextAllyInput(companionAction.state);
    expect(enemyTurns.state.currentActorId).toBe("hero");
    expect(enemyTurns.events).toEqual([]);
    expect(enemyTurns.state.combatants.find((combatant) => combatant.id === "hero")?.hp).toBe(15);
  });

  it("固定操作列で勝利し、勝敗確定後の追撃を行わず、再戦を初期化する", () => {
    const victoryDefinitions: readonly BattleCombatantDefinition[] = [
      { id: "hero", team: "ally", speed: 100, hp: 20, attackPower: 20 },
      { id: "companion", team: "ally", speed: 90, hp: 20, attackPower: 20 },
      { id: "first-enemy", team: "enemy", speed: 80, hp: 5, attackPower: 0 },
      { id: "second-enemy", team: "enemy", speed: 70, hp: 5, attackPower: 0 },
    ];
    let state = advanceBattleToNextAllyInput(createBattleState(victoryDefinitions)).state;
    const events: string[] = [];
    while (state.outcome === "ongoing") {
      const actor = state.combatants.find((combatant) => combatant.id === state.currentActorId);
      if (actor?.team !== "ally") throw new Error("味方入力待ちになっていません");
      const target = state.combatants.find((combatant) => combatant.team === "enemy" && combatant.isAlive);
      if (target === undefined) throw new Error("攻撃対象が存在しません");
      const result = performBasicAttackAndAdvanceToAllyInput(state, actor.id, target.id);
      expect(result.accepted).toBe(true);
      if (!result.accepted) return;
      events.push(...result.events.map((event) => event.type));
      state = result.state;
    }
    expect(state.outcome).toBe("victory");
    expect(events.filter((type) => type === "battle-ended")).toHaveLength(1);
    expect(advanceBattleToNextAllyInput(state)).toEqual({ state, events: [] });

    const rematch = createBattleState(victoryDefinitions);
    expect(rematch.outcome).toBe("ongoing");
    expect(rematch.combatants.map(({ id, hp }) => ({ id, hp }))).toEqual([
      { id: "hero", hp: 20 },
      { id: "companion", hp: 20 },
      { id: "first-enemy", hp: 5 },
      { id: "second-enemy", hp: 5 },
    ]);
    expect(advanceBattleToNextAllyInput(rematch).state.currentActorId).toBe("hero");
  });

  it("敗北用データでは敵の同じルールで敗北し、後続の敵は追撃しない", () => {
    const defeatDefinitions: readonly BattleCombatantDefinition[] = [
      { id: "hero", team: "ally", speed: 100, hp: 1, attackPower: 1 },
      { id: "first-enemy", team: "enemy", speed: 80, hp: 20, attackPower: 3 },
      { id: "second-enemy", team: "enemy", speed: 70, hp: 20, attackPower: 2 },
    ];
    const state = advanceBattleToNextAllyInput(createBattleState(defeatDefinitions)).state;
    const result = performBasicAttackAndAdvanceToAllyInput(state, "hero", "first-enemy");
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.outcome).toBe("defeat");
    expect(result.events.filter((event) => event.type === "attack" && event.actorId !== "hero")).toHaveLength(1);
    expect(result.events.at(-1)).toEqual({ type: "battle-ended", outcome: "defeat" });
  });
});

it("通常攻撃パッシブだけでも命中乱数を使い、負の補正を拒否する", () => {
  const combatants = [
    { id: "hero", team: "ally" as const, hp: 20, speed: 100, attackPower: 0, basicAttackBonus: 3, hitRate: 0.1 },
    { id: "enemy", team: "enemy" as const, hp: 20, speed: 50, attackPower: 1 },
  ];
  const state = advanceBattleToNextActor(createBattleState(combatants, 1));
  const result = performBasicAttack(state, "hero", "enemy");
  expect(result.accepted).toBe(true);
  expect(result.state.combatants.find(({ id }) => id === "enemy")?.hp).toBe(20);
  expect(result.state.randomState).not.toBe(1);
  for (const basicAttackBonus of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
    expect(() => createBattleState([{ ...combatants[0], basicAttackBonus }, combatants[1]])).toThrow();
  }
});
