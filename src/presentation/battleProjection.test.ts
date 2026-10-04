import { describe, expect, it } from "vitest";
import {
  advanceBattleToNextAllyInput,
  createBattleState,
  performBasicAttackAndAdvanceToAllyInput,
} from "../game/battle";
import { createBattlePlayback, reduceBattlePlayback } from "./battlePlayback";
import { battleActionText, projectBattleActors, projectInitialBattleActors } from "./battleProjection";
import { projectSymptoms } from "./symptomProjection";

function record(enemyHp = 20) {
  const before = advanceBattleToNextAllyInput(
    createBattleState([
      { id: "player", team: "ally", speed: 100, hp: 20, attackPower: 8 },
      { id: "enemy", team: "enemy", speed: 90, hp: enemyHp, attackPower: 4 },
    ]),
  ).state;
  const result = performBasicAttackAndAdvanceToAllyInput(before, "player", "enemy");
  if (!result.accepted) throw new Error(result.reason);
  return { before, after: result.state, events: result.events };
}
const sample = (elapsedMs: number, reduced = false) =>
  reduceBattlePlayback(createBattlePlayback(record(), 1, reduced), { type: "advance", elapsedMs });

describe("明示した戦闘表示時刻の投影", () => {
  it("構えと被弾の色を標本の時刻から求め、終端とreduced motionでは通常の色へ戻す", () => {
    expect(projectBattleActors(sample(190)).find(({ id }) => id === "player")?.emissive).toEqual([1, 0.86, 0.64]);
    expect(projectBattleActors(sample(460)).find(({ id }) => id === "enemy")?.emissive).toEqual([
      1,
      expect.closeTo(0.536, 12),
      expect.closeTo(0.456, 12),
    ]);
    for (const state of [sample(600), sample(190, true), sample(460, true)]) {
      expect(projectBattleActors(state).map(({ emissive }) => emissive)).toEqual([
        [1, 1, 1],
        [1, 1, 1],
      ]);
    }
    expect(battleActionText(sample(440))).toEqual({ label: "通常攻撃", result: "−8" });
    expect(battleActionText(sample(5000))).toEqual({ label: "", result: "" });
  });

  it("HP0でも退場完了までspriteを描き、実canvas標本とDOM標本を独立に与えられる", () => {
    const confirmed = record(5);
    const initial = createBattlePlayback(confirmed);
    const dom = reduceBattlePlayback(initial, { type: "advance", elapsedMs: 900 });
    const painted = reduceBattlePlayback(initial, { type: "advance", elapsedMs: 896 });
    expect(dom.display.combatants.find(({ id }) => id === "enemy")?.hp).toBe(0);
    expect(dom.visibleCombatantIds).toContain("enemy");
    expect(projectBattleActors(painted).find(({ id }) => id === "enemy")).toMatchObject({
      visible: true,
      opacity: 1 - 56 / 240,
    });
    const ended = reduceBattlePlayback(initial, { type: "advance", elapsedMs: 1080 });
    expect(projectBattleActors(ended).find(({ id }) => id === "enemy")?.visible).toBe(false);
    const still = reduceBattlePlayback(createBattlePlayback(confirmed, 1, true), { type: "advance", elapsedMs: 500 });
    expect(still.visibleCombatantIds).toContain("enemy");
    expect(projectBattleActors(still).find(({ id }) => id === "enemy")).toMatchObject({ visible: false, opacity: 0 });
    expect(confirmed.before.combatants.find(({ id }) => id === "enemy")?.hp).toBe(5);
    expect(confirmed.after.combatants.find(({ id }) => id === "enemy")?.hp).toBe(0);
    expect(projectInitialBattleActors(confirmed.after.combatants)).toEqual([
      { id: "player", visible: true, opacity: 1, emissive: [1, 1, 1] },
      { id: "enemy", visible: false, opacity: 1, emissive: [1, 1, 1] },
    ]);
  });

  it("症状・疲労の意味と必要な街回数を投影し、開示状態だけを変更できる", () => {
    expect(projectSymptoms({ physicalFatigue: 50, haze: 25, incapacityRecoverySteps: 6 }, 20, ["haze"])).toEqual([
      {
        kind: "physicalFatigue",
        icon: "体",
        label: "肉体疲労・中度",
        detail: "最大HP × 66.67%（あと街探索5回）",
        open: false,
      },
      { kind: "haze", icon: "朦", label: "朦朧・軽度", detail: "命中率 × 92.31%（あと街探索3回）", open: true },
      { kind: "incapacity", icon: "休", label: "戦闘不能", detail: "戦闘参加不可（あと街探索6回）", open: false },
      {
        kind: "mentalFatigue",
        icon: "精",
        label: "精神疲労・なし",
        detail: "負荷付きスキル効果 × 83.33%（あと街探索2回）",
        open: false,
      },
    ]);
    expect(projectSymptoms({ physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null }, 0)).toEqual([]);
  });
});
