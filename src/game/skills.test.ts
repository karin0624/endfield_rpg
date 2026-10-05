import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { skillCatalog } from "../content/skillDefinitions";
import {
  type ActiveSkillDefinition,
  mentalFatigueAffectedQuantity,
  type SkillCatalog,
  type SkillDefinition,
  skillById,
  skillTierForLevel,
  validateSkillCatalog,
} from "./skills";

const strike: ActiveSkillDefinition = {
  id: "test-strike",
  name: "検証用攻撃",
  description: "敵1体へ12ダメージ",
  tier: "normal",
  type: "active",
  effect: { type: "damage", amount: 12, scaling: { stat: "attackPower", coefficient: 0.5 } },
  mentalFatigueIncrease: 4,
  scenes: ["battle"],
  target: "single-enemy",
};
function replaceStrike(skill: SkillDefinition): SkillCatalog {
  return {
    ...skillCatalog,
    skills: skillCatalog.skills.map((candidate) => (candidate.id === "test-strike" ? skill : candidate)),
  };
}

describe("スキル定義", () => {
  it.each([
    [2, "normal"],
    [4, "normal"],
    [6, "normal"],
    [5, "advanced"],
    [15, "advanced"],
    [25, "advanced"],
    [10, "ultimate"],
    [20, "ultimate"],
    [30, "ultimate"],
  ] as const)("到達Lv%sは%s候補になる", (level, tier) => {
    expect(skillTierForLevel(level)).toBe(tier);
  });
  it.each([0, 1, -5, 2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "不正な到達レベル%sを拒否する",
    (level) => {
      expect(() => skillTierForLevel(level)).toThrow();
    },
  );
  it("両キャラが共有する群で各分類の攻撃・回復・パッシブ3択を検証できる", () => {
    expect(() => validateSkillCatalog(skillCatalog, characters)).not.toThrow();
    for (const characterId of ["player", "gilberta"]) {
      const profile = skillCatalog.characters.find((entry) => entry.characterId === characterId);
      expect(profile).toMatchObject({ poolId: "test-shared", initialSkillIds: ["test-strike", "test-heal"] });
      const pool = skillCatalog.pools.find((entry) => entry.id === profile?.poolId);
      if (!pool) throw new Error("候補群がありません");
      for (const [tier, damage, healing, bonus] of [
        ["normal", 12, 8, 2],
        ["advanced", 24, 16, 4],
        ["ultimate", 36, 24, 6],
      ] as const) {
        const choices = pool.candidates[tier].map((id) => skillById(skillCatalog, id));
        expect(choices).toHaveLength(tier === "normal" ? 7 : 3);
        expect(choices.map(({ effect }) => effect)).toEqual(
          expect.arrayContaining([
            { type: "damage", amount: damage, scaling: { stat: "attackPower", coefficient: 0.5 } },
            { type: "hp-recovery", amount: healing, scaling: { stat: "maxHp", coefficient: 0.5 } },
            { type: "basic-attack-power-bonus", rankAmounts: [bonus, bonus * 2] },
          ]),
        );
      }
    }
  });
  it("増加するアクティブのダメージ・回復量だけを識別する", () => {
    expect(mentalFatigueAffectedQuantity(skillById(skillCatalog, "test-strike"))).toBe("damage");
    expect(mentalFatigueAffectedQuantity(skillById(skillCatalog, "test-heal"))).toBe("hp-recovery");
    expect(mentalFatigueAffectedQuantity(skillById(skillCatalog, "test-strength"))).toBeNull();
    expect(mentalFatigueAffectedQuantity({ type: "basic-attack" })).toBeNull();
    expect(mentalFatigueAffectedQuantity({ ...strike, mentalFatigueIncrease: 0 })).toBeNull();
    expect(mentalFatigueAffectedQuantity({ ...strike, mentalFatigueIncrease: 0.25 })).toBe("damage");
  });
  it("整数以外の効果量・疲労増加や増加量0も定義できる", () => {
    for (const fatigue of [0, 0.25]) {
      expect(() =>
        validateSkillCatalog(
          replaceStrike({
            ...strike,
            mentalFatigueIncrease: fatigue,
            effect: { type: "damage", amount: 12.5, scaling: { stat: "attackPower", coefficient: 0.5 } },
          }),
          characters,
        ),
      ).not.toThrow();
    }
  });
  it("同種スキルを定義と候補登録で追加できる", () => {
    const catalog: SkillCatalog = {
      ...skillCatalog,
      skills: [
        ...skillCatalog.skills,
        {
          ...strike,
          id: "extra-strike",
          effect: { type: "damage", amount: 13, scaling: { stat: "attackPower" as const, coefficient: 0.5 } },
        },
      ],
      pools: [
        {
          id: "test-shared",
          candidates: {
            ...skillCatalog.pools[0].candidates,
            normal: ["test-strike", "test-heal", "test-strength", "extra-strike"],
          },
        },
      ],
    };
    expect(() => validateSkillCatalog(catalog, characters)).not.toThrow();
    expect(skillById(catalog, "extra-strike").effect).toMatchObject({ type: "damage", amount: 13 });
  });
  it("未知スキルIDを拒否する", () => {
    expect(() => skillById(skillCatalog, "missing")).toThrow("スキル定義がありません");
  });
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "非有限・負の数値%sを拒否する",
    (amount) => {
      expect(() =>
        validateSkillCatalog(replaceStrike({ ...strike, mentalFatigueIncrease: amount }), characters),
      ).toThrow("精神疲労増加量");
      expect(() =>
        validateSkillCatalog(replaceStrike({ ...strike, effect: { ...strike.effect, amount } }), characters),
      ).toThrow("効果量");
      expect(() =>
        validateSkillCatalog(
          {
            ...skillCatalog,
            skills: [
              ...skillCatalog.skills,
              {
                id: "bad-passive",
                name: "仮",
                description: "仮",
                tier: "normal",
                type: "passive",
                effect: { type: "basic-attack-power-bonus", rankAmounts: [amount] },
              },
            ],
          },
          characters,
        ),
      ).toThrow("効果量");
    },
  );
  it.each([
    { ...strike, id: "" },
    { ...strike, name: " " },
    { ...strike, description: "" },
    { ...strike, tier: "unknown" },
    { ...strike, scenes: [] },
    { ...strike, scenes: ["battle", "battle"] },
    { ...strike, scenes: ["unknown"] },
    { ...strike, target: "unknown" },
    { ...strike, target: "single-ally" },
    { ...strike, scenes: ["branch"] },
    { ...strike, effect: { type: "hp-recovery", amount: 8, scaling: { stat: "attackPower", coefficient: 0.5 } } },
    { ...strike, effect: { type: "fatigue-recovery", amount: 8 } },
    { ...skillById(skillCatalog, "test-strength"), mentalFatigueIncrease: 0 },
    { ...skillById(skillCatalog, "test-strength"), scenes: ["battle"] },
    { ...skillById(skillCatalog, "test-strength"), target: "single-ally" },
  ])("不正な分類・場面・対象・パッシブ操作を拒否する: %j", (badSkill) => {
    // Deliberately corrupt typed authored data to exercise validation.
    const catalog =
      badSkill.type === "passive"
        ? {
            ...skillCatalog,
            skills: skillCatalog.skills.map((skill) =>
              skill.id === "test-strength" ? (badSkill as unknown as SkillDefinition) : skill,
            ),
          }
        : replaceStrike(badSkill as SkillDefinition);
    expect(() => validateSkillCatalog(catalog, characters)).toThrow(
      badSkill.type === "passive" ? "パッシブ定義" : undefined,
    );
  });
  it.each([
    { ...skillCatalog, skills: [...skillCatalog.skills, strike] },
    { ...skillCatalog, pools: [...skillCatalog.pools, skillCatalog.pools[0]] },
    { ...skillCatalog, characters: [...skillCatalog.characters, skillCatalog.characters[0]] },
  ])("スキル・群・キャラ対応の重複を拒否する [%#]", (catalog) => {
    expect(() => validateSkillCatalog(catalog, characters)).toThrow("重複");
  });
  it.each([
    ["test-strike", "test-heal", "missing"],
    ["test-strike", "test-heal", "test-strike"],
    ["test-strike", "test-heal", "test-strength-advanced"],
    ["test-strike", "test-heal"],
    ["test-strike", "test-heal", ""],
  ])("候補IDの参照切れ・重複・分類違い・不足・空IDを拒否する: [%#] %j", (...ids) => {
    expect(() =>
      validateSkillCatalog(
        {
          ...skillCatalog,
          pools: [{ id: "test-shared", candidates: { ...skillCatalog.pools[0].candidates, normal: ids } }],
        },
        characters,
      ),
    ).toThrow();
  });
  it.each([
    { characterId: "missing", poolId: "test-shared", initialSkillIds: null },
    { characterId: "player", poolId: "missing", initialSkillIds: null },
    { characterId: "player", poolId: "test-shared", initialSkillIds: ["missing"] },
    { characterId: "player", poolId: "test-shared", initialSkillIds: ["test-strike", "test-strike"] },
  ])("キャラ・候補群・初期スキル参照と初期スキル重複を拒否する: %j", (profile) => {
    expect(() => validateSkillCatalog({ ...skillCatalog, characters: [profile] }, characters)).toThrow();
  });
  it.each([{ initialSkillIds: null }, { initialSkillIds: [] }, { initialSkillIds: ["test-strike", "test-strength"] }])(
    "未決定・空・既知初期スキルを扱う: %j",
    ({ initialSkillIds }) => {
      expect(() =>
        validateSkillCatalog(
          {
            ...skillCatalog,
            characters: [{ characterId: "player", poolId: "test-shared", initialSkillIds }],
          },
          characters,
        ),
      ).not.toThrow();
    },
  );
});
