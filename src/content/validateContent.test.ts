import { describe, expect, it } from "vitest";
import { type ContentDefinitions, contentDefinitions, validateContent } from "./validateContent";

function fixture(): ContentDefinitions {
  return structuredClone(contentDefinitions);
}

describe("コンテンツ追加時の定義と参照", () => {
  it("本番の全定義を npm run check で検証する", () => {
    expect(() => validateContent(contentDefinitions)).not.toThrow();
  });
  it("仲間・加入イベント・既存効果のスキルをデータ追加だけで接続できる", () => {
    const c = fixture();
    const character = { ...c.characters[1], id: "new-companion", name: "追加の仲間" };
    const newSkill = { ...c.skills.skills[0], id: "new-strike" };
    const roster = [...c.characters, character];
    const conversation = {
      id: "new-recruitment",
      startNodeId: "intro",
      nodes: {
        intro: { type: "line" as const, text: "同行を相談する", nextNodeId: "join" },
        join: { type: "end" as const, recruitments: [{ characterId: character.id, setFlags: ["joined-new"] }] },
      },
    };
    validateContent({
      ...c,
      characters: roster,
      adventure: {
        ...c.adventure,
        conversations: [...c.adventure.conversations, conversation],
        places: [
          ...c.adventure.places,
          { id: "new-place", label: "新しい場所", routes: [{ conversationId: conversation.id }] },
        ],
      },
      growth: {
        ...c.growth,
        characters: roster,
        progression: {
          ...c.growth.progression,
          initial: [...c.growth.progression.initial, { ...c.growth.progression.initial[0], characterId: character.id }],
        },
      },
      skills: {
        ...c.skills,
        skills: [...c.skills.skills, newSkill],
        characters: [
          ...c.skills.characters,
          { characterId: character.id, poolId: "test-shared", initialSkillIds: [newSkill.id] },
        ],
      },
      save: {
        ...c.save,
        characters: roster,
        placeIds: [...c.save.placeIds, "new-place"],
        recruitmentFlags: [...(c.save.recruitmentFlags ?? []), { flag: "joined-new", characterId: character.id }],
      },
    });
  });
  it.each([
    [
      "開始場所",
      (c: ContentDefinitions) => ({ ...c, initial: { ...c.initial, startingPlaceId: "missing" } }),
      "開始場所がありません: missing",
    ],
    [
      "成長定義の欠落",
      (c: ContentDefinitions) => ({
        ...c,
        growth: {
          ...c.growth,
          progression: { ...c.growth.progression, initial: c.growth.progression.initial.slice(0, 1) },
        },
      }),
      "初期成長がありません: gilberta",
    ],
    [
      "成長定義の参照切れ",
      (c: ContentDefinitions) => ({
        ...c,
        growth: {
          ...c.growth,
          progression: {
            ...c.growth.progression,
            initial: [...c.growth.progression.initial, { ...c.growth.progression.initial[0], characterId: "missing" }],
          },
        },
      }),
      "初期成長のキャラクター参照がありません: missing",
    ],
    [
      "スキル対応の欠落",
      (c: ContentDefinitions) => ({ ...c, skills: { ...c.skills, characters: c.skills.characters.slice(0, 1) } }),
      "初期スキル定義が未接続です: gilberta",
    ],
    [
      "初期習得未決",
      (c: ContentDefinitions) => ({
        ...c,
        skills: { ...c.skills, characters: c.skills.characters.map((p) => ({ ...p, initialSkillIds: null })) },
      }),
      "初期スキル定義が未接続です: player",
    ],
    [
      "加入保存対応の欠落",
      (c: ContentDefinitions) => ({ ...c, save: { ...c.save, recruitmentFlags: [] } }),
      "加入イベントの保存フラグ対応がありません",
    ],
    [
      "保存イベントの参照切れ",
      (c: ContentDefinitions) => ({
        ...c,
        save: {
          ...c.save,
          recruitmentFlags: [...(c.save.recruitmentFlags ?? []), { flag: "missing", characterId: "gilberta" }],
        },
      }),
      "保存加入フラグに対応するイベントがありません: missing/gilberta",
    ],
    [
      "保存キャラの参照切れ",
      (c: ContentDefinitions) => ({
        ...c,
        save: {
          ...c.save,
          recruitmentFlags: [...(c.save.recruitmentFlags ?? []), { flag: "missing", characterId: "missing" }],
        },
      }),
      "保存加入フラグのキャラクター参照がありません: missing/missing",
    ],
    [
      "保存場所の欠落",
      (c: ContentDefinitions) => ({ ...c, save: { ...c.save, placeIds: [] } }),
      "保存対象の場所がありません",
    ],
  ] as const)("%sを具体的に報告する", (_, change, message) => {
    expect(() => validateContent(change(fixture()))).toThrow(message);
  });
  it("加入キャラの参照切れは会話とノードを示す", () => {
    const c = fixture();
    const adventure = {
      ...c.adventure,
      conversations: [
        ...c.adventure.conversations,
        {
          id: "broken-event",
          startNodeId: "intro",
          nodes: {
            intro: { type: "line" as const, text: "同行を相談する", nextNodeId: "join" },
            join: { type: "end" as const, recruitments: [{ characterId: "missing", setFlags: ["joined-missing"] }] },
          },
        },
      ],
    };
    expect(() => validateContent({ ...c, adventure })).toThrow("broken-event/join/missing");
  });
  it("控え候補のキャラIDと敵IDの衝突も既存の戦闘検証で拒否する", () => {
    const c = fixture();
    const dungeon = {
      ...c.dungeon,
      nodes: c.dungeon.nodes.map((node) =>
        node.type === "battle"
          ? {
              ...node,
              enemies: node.enemies.map((enemy, index) => (index === 0 ? { ...enemy, id: "gilberta" } : enemy)),
            }
          : node,
      ),
    };
    expect(() => validateContent({ ...c, dungeon })).toThrow("重複");
  });
  it("空の初期習得は解決済みとして扱う", () => {
    const c = fixture();
    validateContent({
      ...c,
      skills: { ...c.skills, characters: c.skills.characters.map((p) => ({ ...p, initialSkillIds: [] })) },
    });
  });
  it.each(["battleExperience", "eventExperience", "townExperience"] as const)("%sは安全な非負整数", (key) => {
    const c = fixture();
    for (const value of [-1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => validateContent({ ...c, growth: { ...c.growth, [key]: value } })).toThrow(
        `経験値報酬は安全な非負整数です: ${key}`,
      );
    }
    validateContent({ ...c, growth: { ...c.growth, [key]: 0 } });
  });
  it("個別validatorへ会話・候補・成長の不正を委譲する", () => {
    const c = fixture();
    expect(() =>
      validateContent({
        ...c,
        skills: {
          ...c.skills,
          pools: c.skills.pools.map((p) => ({
            ...p,
            candidates: { ...p.candidates, normal: ["missing", "test-strike", "test-heal"] },
          })),
        },
      }),
    ).toThrow("missing");
    expect(() =>
      validateContent({
        ...c,
        growth: {
          ...c.growth,
          progression: {
            ...c.growth.progression,
            rules: [{ fromLevel: 1, requiredExperience: 0, bonus: { maxHp: 0, attackPower: 0 } }],
          },
        },
      }),
    ).toThrow("成長ルール");
    expect(() =>
      validateContent({
        ...c,
        adventure: { ...c.adventure, places: [{ id: "bad", label: "不正", routes: [{ conversationId: "missing" }] }] },
      }),
    ).toThrow("missing");
  });
});
