import { describe, expect, it } from "vitest";
import { mentalFatigueDefinition as tuning } from "../content/mentalFatigueDefinition";
import {
  mentalFatigueLabel,
  mentalFatigueMultiplier,
  recoverMentalFatigue,
  validateMentalFatigueDefinition,
} from "./mentalFatigue";

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

it.each([
  [24.9999, "なし", 0.800000640000512],
  [25, "軽度", 0.8],
  [25.0001, "軽度", 0.799999360000512],
  [49.9999, "軽度", 0.6666671111114074],
  [50, "中度", 2 / 3],
  [50.0001, "中度", 0.6666662222225186],
  [74.9999, "中度", 0.5714288979593704],
  [75, "重度", 4 / 7],
  [75.0001, "重度", 0.5714282448981458],
] as const)("精神疲労%sの表示境界は量を丸めない", (value, label, multiplier) => {
  expect(mentalFatigueLabel(value, tuning)).toBe(label);
  expect(mentalFatigueMultiplier(value, tuning)).toBeCloseTo(multiplier, 12);
});
it("精神疲労の正有限な係数と昇順閾値だけを受理する", () => {
  for (const value of [0, -1, Number.NaN, Infinity, -Infinity]) {
    for (const field of ["scale", "townRecovery"] as const)
      expect(() => validateMentalFatigueDefinition({ ...tuning, [field]: value })).toThrow();
    for (const index of [0, 1, 2]) {
      const thresholds: [number, number, number] = [25, 50, 75];
      thresholds[index] = value;
      expect(() => validateMentalFatigueDefinition({ ...tuning, labelThresholds: thresholds })).toThrow();
    }
  }
  for (const labelThresholds of [
    [25, 25, 75],
    [25, 75, 75],
    [50, 25, 75],
    [25, 75, 50],
  ] as const)
    expect(() => validateMentalFatigueDefinition({ ...tuning, labelThresholds })).toThrow();
});
