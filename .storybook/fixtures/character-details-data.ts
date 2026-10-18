import type { CharacterDetailsModel } from "../../src/presentation/characterDetails";

/** Display content shared by the details component and its composed Party screen. */
export const rossiDetails = {
  id: "player",
  name: "ロッシ",
  portrait: "characters/rossi/expressions/neutral.png",
  stats: [
    ["HP", "20 / 20", ""],
    ["攻撃力", "8", ""],
    ["速度", "100", ""],
    ["命中率", "100%", ""],
    ["レベル", "1", ""],
    ["精神疲労", "0（なし）", ""],
    ["肉体疲労", "0（なし）", "上限 200 · 街探索1回につき 10 回復"],
    ["朦朧", "0（なし）", "上限 200 · 街探索1回につき 10 回復"],
  ],
  skills: [
    {
      name: "検証用攻撃",
      kind: "アクティブ",
      notes: [
        "生存中の敵1体へ、12＋攻撃力×0.5のダメージ。",
        "初期習得",
        "戦闘 · 生存中の敵1体 · 精神疲労 +4",
        "対象ごとに最大1回攻撃（撃破時は打切り）。",
        "効果量は使用前の精神疲労で減衰します。効果適用後に精神疲労が増加します。",
      ],
    },
    {
      name: "検証用回復",
      kind: "アクティブ",
      notes: [
        "生存中の味方1体のHPを8＋最大HP×0.5回復。自分も対象。",
        "初期習得",
        "戦闘／分岐 · 生存中の味方1体（自分を含む） · 精神疲労 +3",
        "効果量は使用前の精神疲労で減衰します。効果適用後に精神疲労が増加します。",
      ],
    },
  ],
  emptySkills: "習得スキルなし",
  symptoms: "",
  unavailable: "",
  portraitFailed: false,
} satisfies NonNullable<CharacterDetailsModel["dialog"]>;
