import { describe, expect, it } from "vitest";
import { loadSymptomDefinition as rules } from "../content/loadSymptomDefinition";
import {
  accumulateLoadSymptom,
  additionalSymptomProbability,
  applyAdditionalLoadSymptom,
  loadSymptomDose,
  loadSymptomLabel,
  loadSymptomMultiplier,
  recoverLoadSymptom,
  validateLoadSymptomDefinition,
  validateLoadSymptomRules,
} from "./loadSymptoms";

const physical = rules.symptoms.physicalFatigue;
const haze = rules.symptoms.haze;
const healthy = { physicalFatigue: 0, haze: 0 };

describe("連続した負荷系症状の試用値", () => {
  it.each([
    [0, "なし", 1, 1, 0],
    [10, "なし", 0.9090909090909091, 0.967741935483871, 0],
    [25, "軽度", 0.8, 0.9230769230769231, 15],
    [50, "中度", 0.6666666666666666, 0.8571428571428571, 40],
    [75, "重度", 0.5714285714285714, 0.8, 65],
    [100, "重度", 0.5, 0.75, 90],
    [200, "重度", 0.3333333333333333, 0.6, 190],
  ] as const)("値%sの表示・倍率・固定量回復", (value, label, hpMultiplier, hitMultiplier, recovered) => {
    expect(loadSymptomLabel(value, physical)).toBe(label);
    expect(loadSymptomLabel(value, haze)).toBe(label);
    expect(loadSymptomMultiplier(value, physical)).toBeCloseTo(hpMultiplier, 12);
    expect(loadSymptomMultiplier(value, haze)).toBeCloseTo(hitMultiplier, 12);
    expect(recoverLoadSymptom(value, physical)).toBe(recovered);
    expect(recoverLoadSymptom(value, haze)).toBe(recovered);
  });
  it.each([25, 50, 75])("表示境界%sの直前・直後で効果が飛ばない", (threshold) => {
    for (const definition of [physical, haze]) {
      const before = loadSymptomMultiplier(threshold - 0.0001, definition);
      const after = loadSymptomMultiplier(threshold + 0.0001, definition);
      expect(before).toBeGreaterThan(after);
      expect(before - after).toBeLessThan(0.000002);
    }
  });
  it("重度の再発症でも数値と効果が悪化し、部分回復でも改善する", () => {
    const result = applyAdditionalLoadSymptom({ physicalFatigue: 80, haze: 0 }, 100, 20, 1, rules);
    expect(result).toEqual({
      symptoms: { physicalFatigue: 100, haze: 0 },
      randomState: 1586005467,
      application: { kind: "physicalFatigue", before: 80, after: 100 },
    });
    expect(loadSymptomLabel(80, physical)).toBe("重度");
    expect(loadSymptomMultiplier(80, physical)).toBeCloseTo(0.5555555555555556, 12);
    expect(loadSymptomMultiplier(result.symptoms.physicalFatigue, physical)).toBe(0.5);
    const recovered = recoverLoadSymptom(result.symptoms.physicalFatigue, physical);
    expect(recovered).toBe(90);
    expect(loadSymptomLabel(recovered, physical)).toBe("重度");
    expect(loadSymptomMultiplier(recovered, physical)).toBeCloseTo(0.5263157894736842, 12);
  });
  it("小・中・大負荷は異なる数値と完治回数になり、小数も保持する", () => {
    for (const [load, ticks] of [
      [4, 1],
      [20, 2],
      [80, 8],
    ]) {
      const dose = loadSymptomDose(load, physical);
      expect(dose).toBe(load);
      let value = accumulateLoadSymptom(0, dose, physical);
      for (let tick = 1; tick < ticks; tick++) {
        value = recoverLoadSymptom(value, physical);
        expect(value).toBeGreaterThan(0);
      }
      expect(recoverLoadSymptom(value, physical)).toBe(0);
    }
    expect(accumulateLoadSymptom(0.125, loadSymptomDose(0.25, physical), physical)).toBe(0.375);
    expect(recoverLoadSymptom(10.125, physical)).toBe(0.125);
    expect(recoverLoadSymptom(0.125, physical)).toBe(0);
  });
  it("大負荷は症状ごとの上限で止まり、調整した係数・上限・回復量を使う", () => {
    const tuned = { ...physical, cap: 300, loadCoefficient: 2, townRecovery: 7 };
    expect(loadSymptomDose(20, tuned)).toBe(40);
    expect(loadSymptomDose(Number.MAX_VALUE, tuned)).toBe(300);
    expect(accumulateLoadSymptom(190, Number.MAX_VALUE, physical)).toBe(200);
    expect(accumulateLoadSymptom(290, 40, tuned)).toBe(300);
    expect(recoverLoadSymptom(290, tuned)).toBe(283);
  });
});

describe("追加発症の確率と乱数契約", () => {
  it.each([
    [99.999999, false],
    [100, false],
    [100.000001, true],
  ])("疲労%sの発症確率と乱数0.5の境界を判定する", (fatigue, occurs) => {
    const result = applyAdditionalLoadSymptom(healthy, fatigue, 4, 2782269413, rules);
    expect(result.symptoms).toEqual({ physicalFatigue: 0, haze: occurs ? 4 : 0 });
    expect(result.application).toEqual(occurs ? { kind: "haze", before: 0, after: 4 } : null);
    expect(result.randomState).toBe(occurs ? 3161387871 : 2147483648);
  });
  it.each([
    [0, 0],
    [25, 0.2],
    [100, 0.5],
    [300, 0.75],
    [900, 0.9],
  ])("使用後精神疲労%sの確率は%s", (fatigue, probability) => {
    expect(additionalSymptomProbability(fatigue, rules.probabilityScale)).toBeCloseTo(probability, 12);
  });
  it("確率は単調で、大きな有限入力でもオーバーフローしない", () => {
    let previous = 0;
    for (const value of [0.125, 10, 25, 50, 75, 100, 1000, Number.MAX_VALUE]) {
      const probability = additionalSymptomProbability(value, 100);
      expect(probability).toBeGreaterThan(previous);
      expect(probability).toBeLessThanOrEqual(1);
      previous = probability;
    }
    expect(additionalSymptomProbability(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(0.5);
  });
  it("失敗は判定1回、成功は判定→候補選択で2回だけ消費する", () => {
    expect(applyAdditionalLoadSymptom(healthy, 25, 4, 1, rules)).toEqual({
      symptoms: healthy,
      randomState: 1015568748,
      application: null,
    });
    expect(applyAdditionalLoadSymptom(healthy, 100, 4, 1, rules)).toEqual({
      symptoms: { physicalFatigue: 4, haze: 0 },
      randomState: 1586005467,
      application: { kind: "physicalFatigue", before: 0, after: 4 },
    });
    // Seed 3's second draw is about 0.55, selecting the second candidate.
    expect(applyAdditionalLoadSymptom(healthy, 100, 20, 3, rules)).toEqual({
      symptoms: { physicalFatigue: 0, haze: 20 },
      randomState: 2365144877,
      application: { kind: "haze", before: 0, after: 20 },
    });
  });
  it("増加量は今回の負荷だけで決まり、精神疲労を二重に乗算しない", () => {
    expect(applyAdditionalLoadSymptom(healthy, 100, 20, 1, rules).symptoms.physicalFatigue).toBe(20);
    expect(applyAdditionalLoadSymptom(healthy, 900, 20, 1, rules).symptoms.physicalFatigue).toBe(20);
    expect(applyAdditionalLoadSymptom(healthy, 100, 80, 1, rules).symptoms.physicalFatigue).toBe(80);
  });
  it("真に上限の候補だけを除き、候補一つでも成功時は選択乱数を消費する", () => {
    expect(applyAdditionalLoadSymptom({ physicalFatigue: 200, haze: 190 }, 100, 20, 1, rules)).toEqual({
      symptoms: { physicalFatigue: 200, haze: 200 },
      randomState: 1586005467,
      application: { kind: "haze", before: 190, after: 200 },
    });
    expect(applyAdditionalLoadSymptom(healthy, 100, 20, 1, { ...rules, candidates: ["haze"] }).application).toEqual({
      kind: "haze",
      before: 0,
      after: 20,
    });
  });
  it("同じ朦朧が連続選択されると重度になっても悪化を続ける", () => {
    const first = applyAdditionalLoadSymptom(healthy, 900, 80, 3, rules);
    expect(first.application).toEqual({ kind: "haze", before: 0, after: 80 });
    const second = applyAdditionalLoadSymptom(first.symptoms, 980, 80, first.randomState, rules);
    expect(second).toEqual({
      symptoms: { physicalFatigue: 0, haze: 160 },
      randomState: 3345418727,
      application: { kind: "haze", before: 80, after: 160 },
    });
    expect(loadSymptomLabel(first.symptoms.haze, haze)).toBe("重度");
    expect(loadSymptomLabel(second.symptoms.haze, haze)).toBe("重度");
    expect(loadSymptomMultiplier(first.symptoms.haze, haze)).toBeCloseTo(0.7894736842105263, 12);
    expect(loadSymptomMultiplier(second.symptoms.haze, haze)).toBeCloseTo(0.6521739130434783, 12);
  });
  it("個別上限と係数を変更しても他の候補へ誤適用しない", () => {
    const tuned = {
      ...rules,
      symptoms: {
        physicalFatigue: { ...physical, cap: 120 },
        haze: { ...haze, cap: 300, loadCoefficient: 2 },
      },
    };
    expect(applyAdditionalLoadSymptom({ physicalFatigue: 120, haze: 200 }, 100, 20, 1, tuned)).toEqual({
      symptoms: { physicalFatigue: 120, haze: 240 },
      randomState: 1586005467,
      application: { kind: "haze", before: 200, after: 240 },
    });
  });
  it("上限到達・空候補・負荷0・確率0は発症も乱数消費もない", () => {
    const capped = { physicalFatigue: 200, haze: 200 };
    expect(applyAdditionalLoadSymptom(capped, 100, 20, 1, rules)).toEqual({
      symptoms: capped,
      randomState: 1,
      application: null,
    });
    for (const [fatigue, load] of [
      [0, 20],
      [100, 0],
    ]) {
      expect(applyAdditionalLoadSymptom(healthy, fatigue, load, 1, rules)).toEqual({
        symptoms: healthy,
        randomState: 1,
        application: null,
      });
    }
    expect(applyAdditionalLoadSymptom(healthy, 100, 20, 1, { ...rules, candidates: [] })).toEqual({
      symptoms: healthy,
      randomState: 1,
      application: null,
    });
  });
});

describe("有限・非負の入力検証", () => {
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("不正値%sを拒否する", (value) => {
    expect(() => loadSymptomMultiplier(value, physical)).toThrow();
    expect(() => loadSymptomLabel(value, physical)).toThrow();
    expect(() => recoverLoadSymptom(value, physical)).toThrow();
    expect(() => accumulateLoadSymptom(0, value, physical)).toThrow();
    expect(() => loadSymptomDose(value, physical)).toThrow();
    expect(() => additionalSymptomProbability(value, 100)).toThrow();
    expect(() => applyAdditionalLoadSymptom(healthy, value, 20, 1, rules)).toThrow();
    expect(() => applyAdditionalLoadSymptom(healthy, 100, value, 1, rules)).toThrow();
    expect(() => applyAdditionalLoadSymptom({ ...healthy, haze: value }, 0, 0, 1, rules)).toThrow();
  });
  it("上限超過の正本、不正seed、確率・症状定義を拒否する", () => {
    expect(() => applyAdditionalLoadSymptom({ ...healthy, physicalFatigue: 201 }, 100, 20, 1, rules)).toThrow();
    for (const seed of [-1, 1.5, 0x100000000, Number.NaN]) {
      expect(() => applyAdditionalLoadSymptom(healthy, 100, 20, seed, rules)).toThrow();
    }
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const key of ["scale", "cap", "loadCoefficient", "townRecovery"] as const) {
        expect(() => validateLoadSymptomDefinition({ ...physical, [key]: value })).toThrow();
      }
      expect(() => additionalSymptomProbability(100, value)).toThrow();
      expect(() => validateLoadSymptomRules({ ...rules, probabilityScale: value })).toThrow();
    }
    for (const labelThresholds of [
      [25, 25, 75],
      [25, 75, 50],
      [25, 50, 200],
    ] as const) {
      expect(() => validateLoadSymptomDefinition({ ...physical, labelThresholds })).toThrow();
    }
    expect(() => validateLoadSymptomRules({ ...rules, candidates: ["haze", "haze"] })).toThrow();
  });
});

it("有限精度で発症確率1になっても判定と候補の2乱数を消費する", () => {
  expect(additionalSymptomProbability(Number.MAX_VALUE, 100)).toBe(1);
  expect(applyAdditionalLoadSymptom(healthy, Number.MAX_VALUE, 4, 1, rules)).toEqual({
    symptoms: { physicalFatigue: 4, haze: 0 },
    randomState: 1586005467,
    application: { kind: "physicalFatigue", before: 0, after: 4 },
  });
});
