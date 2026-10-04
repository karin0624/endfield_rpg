import { expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { actInTown, applyPartyStatus, beginTownExploration } from "../game/expedition";
import { campaignRules, createCampaignGame } from "./campaignModel";
import { calendarLabel, completionFeedback, symptomLabel } from "./statusText";

it("現在の症状と必要な街探索回数を伝え、健康な仲間にラベルを増やさない", () => {
  expect(symptomLabel({ physicalFatigue: 50, haze: 25, incapacityRecoverySteps: 6 })).toBe(
    "肉体疲労・中度 · 最大HP × 66.67%（あと街探索5回） / 朦朧・軽度 · 命中率 × 92.31%（あと街探索3回） / 戦闘不能 · 戦闘参加不可（あと街探索6回）",
  );
  expect(symptomLabel({ physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null })).toBe("");
  expect(calendarLabel()).toBe("1日目 · 昼");
});

it("実際の街完了から全快・療養継続・精神疲労の減少と無変更を伝える", () => {
  let game = createCampaignGame();
  game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 10 }, characters);
  game = applyPartyStatus(game, "player", { kind: "haze", amount: 10 }, characters);
  game = applyPartyStatus(game, "player", { kind: "incapacity" }, characters);
  game = {
    ...game,
    party: { ...game.party, members: game.party.members.map((member) => ({ ...member, mentalFatigue: 20 })) },
  };
  const visit = beginTownExploration(game, "market", initialAdventure);
  const ended = actInTown(
    visit.state,
    { type: "advance" },
    characters,
    initialAdventure,
    campaignRules.fatigue,
    campaignRules,
  );
  expect(ended.accepted).toBe(true);
  if (!ended.accepted) throw new Error(ended.reason);
  expect(completionFeedback(ended.completion, characters)).toEqual([
    "ロッシ · 精神疲労：20 → 10（なし） / 肉体疲労：10 → 0（なし） / 朦朧：10 → 0（なし） / 戦闘不能：あと街探索6回 → 5回",
  ]);
  expect(calendarLabel(ended.state.clock)).toBe("1日目 · 夜");
  expect(completionFeedback(undefined, characters)).toEqual([]);
});
it("街での軽快と復帰を表示し、変化のない仲間は結果へ並べない", () => {
  const before = { physicalFatigue: 50, haze: 25, incapacityRecoverySteps: 1 } as const;
  const after = { physicalFatigue: 40, haze: 15, incapacityRecoverySteps: null } as const;
  expect(
    completionFeedback(
      {
        id: 1,
        kind: "town-exploration",
        calendarHalfDays: 1,
        recoverySteps: 1,
        recovery: [
          { id: "a", before, after, remainingSteps: { physicalFatigue: 4, haze: 2, incapacity: 0 } },
          { id: "b", before: after, after, remainingSteps: { physicalFatigue: 4, haze: 2, incapacity: 0 } },
        ],
      },
      [
        { id: "a", name: "仲間A", maxHp: 20, speed: 100, attackPower: 8 },
        { id: "b", name: "仲間B", maxHp: 20, speed: 100, attackPower: 8 },
      ],
    ),
  ).toEqual([
    "仲間A · 肉体疲労：50 → 40（軽度）（あと街探索4回） / 朦朧：25 → 15（なし）（あと街探索2回） / 戦闘不能から復帰",
  ]);
});
