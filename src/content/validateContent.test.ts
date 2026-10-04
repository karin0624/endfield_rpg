import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../game/createInitialGameState";
import { actInTown, beginTownExploration, type ExpeditionGame } from "../game/expedition";
import type { LoadSymptomKind } from "../game/loadSymptoms";
import { createParty } from "../game/party";
import { deserializeGame, serializeGame } from "../game/save";
import { createExplorationSkills } from "../game/skillAcquisition";
import { skillById } from "../game/skills";
import { type ContentDefinitions, contentDefinitions, validateContent } from "./validateContent";

function fixture(): ContentDefinitions {
  return structuredClone(contentDefinitions);
}

function addedContent(flag = "joined-new"): ContentDefinitions {
  const c = fixture();
  const character = { ...c.characters[1], id: "new-companion", name: "追加の仲間" };
  const newSkill = { ...skillById(c.skills, "test-strike"), id: "new-strike" };
  const roster = [...c.characters, character];
  const conversation = {
    id: "new-recruitment",
    startNodeId: "intro",
    nodes: {
      intro: { type: "line" as const, text: "同行を相談する", nextNodeId: "join" },
      join: { type: "end" as const, recruitments: [{ characterId: character.id, setFlags: [flag] }] },
    },
  };
  const content: ContentDefinitions = {
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
      recruitmentFlags: [...(c.save.recruitmentFlags ?? []), { flag: flag, characterId: character.id }],
    },
  };
  if (!c.save.skills) throw new Error("試験のスキル設定がありません");
  return {
    ...content,
    save: { ...content.save, skills: { ...c.save.skills, catalog: content.skills, growth: content.growth } },
  };
}
function recruitAdded(content: ContentDefinitions): ExpeditionGame {
  const game: ExpeditionGame = {
    adventure: createInitialGameState(content.initial),
    party: createParty(content.characters, ["player"]),
    dungeon: null,
    growth: createExplorationSkills("growth:1", 1, content.growth.progression, content.skills),
  };
  const start = beginTownExploration(game, "new-place", content.adventure);
  if (!start.accepted) throw new Error(start.reason);
  const end = actInTown(
    start.state,
    start.state.clock?.pendingAction?.id ?? -1,
    { type: "advance" },
    content.characters,
    content.adventure,
  );
  if (!end.accepted) throw new Error(end.reason);
  return end.state;
}
function roundTrip(content: ContentDefinitions) {
  const saved = serializeGame(recruitAdded(content), content.save);
  if (!saved.accepted) throw new Error(saved.reason);
  const restored = deserializeGame(saved.data, content.save);
  if (!restored.accepted) throw new Error(restored.reason);
  return restored.state;
}

describe("コンテンツ追加時の定義と参照", () => {
  it("本番の全定義を npm run check で検証する", () => {
    expect(() => validateContent(contentDefinitions)).not.toThrow();
  });
  it("仲間・加入イベント・既存効果を追加し、加入後の成長状態を現行形式で保存往復できる", () => {
    const content = addedContent();
    validateContent(content);
    const restored = roundTrip(content);
    expect(restored.party.members.map(({ id }) => id)).toEqual(["player", "new-companion"]);
    expect(restored.adventure.flags).toContain("joined-new");
    expect(restored.growth?.characters.find(({ characterId }) => characterId === "new-companion")?.learned).toEqual([
      { skillId: "new-strike", type: "active", origin: "initial", acquisition: "initial" },
    ]);
  });
  it("同じ加入フラグを独立したキャラに割り当てると保存できない", () => {
    const content = addedContent("joined-gilberta");
    expect(() => validateContent(content)).toThrow("加入フラグが別の加入を要求します");
    expect(serializeGame(recruitAdded(content), content.save)).toEqual({ accepted: false, reason: "invalid-data" });
  });
  it.each(["catalog", "growth"] as const)("保存側の旧%s参照を拒否し、保存失敗も再現する", (key) => {
    const content = addedContent();
    if (!content.save.skills || !contentDefinitions.save.skills) throw new Error("試験のスキル設定がありません");
    const stale = {
      ...content,
      save: { ...content.save, skills: { ...content.save.skills, [key]: contentDefinitions.save.skills[key] } },
    };
    expect(() => validateContent(stale)).toThrow(
      key === "catalog" ? "save.skills.catalog" : "save.skills.growth.progression",
    );
    if (key === "catalog") {
      expect(() => serializeGame(recruitAdded(stale), stale.save)).toThrow("初期スキル定義が未接続です: new-companion");
    } else {
      expect(serializeGame(recruitAdded(stale), stale.save)).toEqual({ accepted: false, reason: "invalid-data" });
    }
  });
  it("同じ内容の独立した保存定義も受理して往復できる", () => {
    const content = addedContent();
    const independent = { ...content, save: structuredClone(content.save) };
    validateContent(independent);
    expect(roundTrip(independent).party.members.map(({ id }) => id)).toEqual(["player", "new-companion"]);
  });
  it("同じ終了ノードで全員加入する共通フラグは保存往復できる", () => {
    const c = addedContent("joined-together");
    const content: ContentDefinitions = {
      ...c,
      adventure: {
        ...c.adventure,
        conversations: c.adventure.conversations.map((conversation) =>
          conversation.id === "new-recruitment"
            ? {
                ...conversation,
                nodes: {
                  ...conversation.nodes,
                  join: {
                    type: "end",
                    recruitments: [
                      { characterId: "new-companion", setFlags: ["joined-together"] },
                      { characterId: "gilberta" },
                    ],
                  },
                },
              }
            : conversation,
        ),
      },
      save: {
        ...c.save,
        recruitmentFlags: [...(c.save.recruitmentFlags ?? []), { flag: "joined-together", characterId: "gilberta" }],
      },
    };
    validateContent(content);
    const restored = roundTrip(content);
    expect(restored.party.members.map(({ id }) => id)).toEqual(["player", "new-companion", "gilberta"]);
    expect(restored.adventure.flags).toContain("joined-together");
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
    const skills = { ...c.skills, characters: c.skills.characters.map((p) => ({ ...p, initialSkillIds: [] })) };
    if (!c.save.skills) throw new Error("試験のスキル設定がありません");
    validateContent({ ...c, skills, save: { ...c.save, skills: { ...c.save.skills, catalog: skills } } });
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
  it("症状の試用値変更と空候補群を既存APIで検証する", () => {
    const c = fixture();
    validateContent({ ...c, loadSymptoms: { ...c.loadSymptoms, candidates: [], probabilityScale: 150 } });
  });
  it.each(["incapacity", "mentalFatigue"])("追加発症候補%sを既存APIで拒否する", (candidate) => {
    const c = fixture();
    // 型外の定義が混入した場合も実行時検証へ届くことを確認する。
    expect(() =>
      validateContent({ ...c, loadSymptoms: { ...c.loadSymptoms, candidates: [candidate as LoadSymptomKind] } }),
    ).toThrow("追加発症の調整値");
  });
  it("症状の数値定義も既存validatorへ委譲する", () => {
    const c = fixture();
    expect(() =>
      validateContent({
        ...c,
        loadSymptoms: {
          ...c.loadSymptoms,
          symptoms: { ...c.loadSymptoms.symptoms, haze: { ...c.loadSymptoms.symptoms.haze, townRecovery: 0 } },
        },
      }),
    ).toThrow("負荷系症状の調整値");
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
