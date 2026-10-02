import { describe, expect, it } from "vitest";
import { mentalFatigueDefinition as tuning } from "../content/mentalFatigueDefinition";
import { mentalFatigueLabel, mentalFatigueMultiplier, recoverMentalFatigue } from "./mentalFatigue";

describe("連続した精神疲労の試用曲線", () => {
  it.each([
    [10, 0.9090909090909091, 0],
    [40, 0.7142857142857143, 30],
    [80, 0.5555555555555556, 70],
  ])("疲労%iの倍率と街回復", (fatigue, multiplier, recovered) => {
    expect(mentalFatigueMultiplier(fatigue, tuning)).toBeCloseTo(multiplier, 12);
    expect(recoverMentalFatigue(fatigue, tuning)).toBe(recovered);
  });
  it("ラベル境界を越えても数値を丸めず、軽度未満も回復する", () => {
    expect(mentalFatigueLabel(24.99, tuning)).toBe("なし");
    expect(mentalFatigueLabel(25, tuning)).toBe("軽度");
    expect(mentalFatigueMultiplier(24.99, tuning)).toBeCloseTo(0.8000640051204096, 12);
    expect(mentalFatigueMultiplier(25, tuning)).toBe(0.8);
    expect(recoverMentalFatigue(19.125, tuning)).toBe(9.125);
    expect(recoverMentalFatigue(9.125, tuning)).toBe(0);
    expect(mentalFatigueMultiplier(10000, tuning)).toBeGreaterThan(0);
  });
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("不正疲労%sを拒否する", (value) => {
    expect(() => mentalFatigueMultiplier(value, tuning)).toThrow();
    expect(() => recoverMentalFatigue(value, tuning)).toThrow();
  });
});
