import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import { createExplorationSkills } from "../game/skillAcquisition";
import type { SkillCatalog } from "../game/skills";
import { type CharacterDetailsContext, characterLearning, learnedSkillText } from "./characterDetailsText";

const context: CharacterDetailsContext = {
  characters,
  baseCharacters: characters,
  growth: undefined,
  rules: { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules },
};
describe("読み取り専用の詳細表示", () => {
  it("セッション前は初期定義を読み、未決・欠落と明示空配列を区別する", () => {
    const custom = {
      ...context,
      rules: {
        ...context.rules,
        growth: {
          ...growthRules,
          progression: {
            initial: [{ characterId: "player", level: 3, experience: 0, bonus: { maxHp: 0, attackPower: 0 } }],
            rules: [],
          },
        },
      },
    };
    expect(characterLearning("player", custom).level).toBe(3);
    expect(characterLearning("player", custom).learned?.map((skill) => skill.skillId)).toEqual([
      "test-strike",
      "test-heal",
    ]);
    for (const initialSkillIds of [null, []]) {
      const catalog: SkillCatalog = {
        ...skillCatalog,
        characters: [{ characterId: "player", poolId: "test-shared", initialSkillIds }],
      };
      const result = characterLearning("player", { ...context, rules: { ...context.rules, catalog } });
      expect(result.learned).toEqual(initialSkillIds === null ? undefined : []);
    }
    expect(characterLearning("missing", context)).toEqual({ level: undefined, learned: undefined });
  });
  it("現在のレベルと習得を読み、空の習得や欠落を初期値で埋めず、正本を変えない", () => {
    const growth = createExplorationSkills(731, growthRules.progression, skillCatalog);
    const current = {
      ...growth,
      growth: { ...growth.growth, characters: growth.growth.characters.map((entry) => ({ ...entry, level: 4 })) },
      characters: [{ characterId: "player", learned: [] }],
    };
    const before = JSON.stringify(current);
    expect(characterLearning("player", { ...context, growth: current })).toEqual({ level: 4, learned: [] });
    expect(characterLearning("gilberta", { ...context, growth: current }).learned).toBeUndefined();
    expect(JSON.stringify(current)).toBe(before);
  });
  it("ランク2の実効果と上限、初期パッシブの強化分の寿命を説明する", () => {
    const text = learnedSkillText(skillCatalog, {
      skillId: "test-strength",
      type: "passive",
      rank: 2,
      origin: "initial",
      acquisition: "initial",
    });
    expect(text.kind).toBe("パッシブ · ランク 2 / 上限 2");
    expect(text.notes).toContain("現在の効果：通常攻撃のみの威力補正 +4");
    expect(text.notes).toContain("探索中のランク強化分は帰還で初期ランクに戻ります。");
    expect(text.notes.join(" ")).not.toContain("減衰");
  });
  it("保証習得の寿命と取得経路を分け、アクティブにランクを付けない", () => {
    const text = learnedSkillText(skillCatalog, {
      skillId: "test-strike",
      type: "active",
      origin: "expedition",
      acquisition: "guaranteed",
    });
    expect(text.kind).toBe("アクティブ");
    expect(text.notes.join(" ")).toContain("探索中のみ（帰還で失う） · レベル保証で習得");
    expect(text.notes.join(" ")).toContain("戦闘 · 生存中の敵1体 · 精神疲労 +4");
    expect(text.notes.join(" ")).toContain("使用前の精神疲労");
  });
  it("負荷0アクティブに疲労減衰を表示せず、回復は味方と自分を対象とする", () => {
    const text = learnedSkillText(skillCatalog, {
      skillId: "test-light-strike",
      type: "active",
      origin: "expedition",
      acquisition: "choice",
    });
    expect(text.notes.join(" ")).toContain("精神疲労 +0");
    expect(text.notes.join(" ")).not.toContain("減衰");
    const heal = learnedSkillText(skillCatalog, {
      skillId: "test-heal",
      type: "active",
      origin: "initial",
      acquisition: "initial",
    });
    expect(heal.notes.join(" ")).toContain("戦闘／分岐 · 生存中の味方1体（自分を含む）");
  });
});
