import { describe, expect, it } from "vitest";
import { growthRules } from "../content/growthRules";
import { skillCatalog } from "../content/skillDefinitions";
import {
  chooseSkill,
  createExplorationSkills,
  type ExplorationSkills,
  grantSkillExperience,
} from "../game/skillAcquisition";
import type { SkillCatalog } from "../game/skills";
import { reduceGrowthPresentation } from "./growthModel";
import { projectGrowthChoice } from "./growthProjection";

function reward(catalog: SkillCatalog = skillCatalog, experience = 10): ExplorationSkills {
  const state = createExplorationSkills(1, growthRules.progression, catalog);
  const result = grantSkillExperience(
    state,
    { allocations: [{ characterId: "player", experience }] },
    growthRules.progression,
    catalog,
  );
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("確定済みの成長選択と画面", () => {
  it("保持した候補を新規能力・疲労・利用場面として描き、ゲームと乱数を変えない", () => {
    const state = reward();
    const before = structuredClone(state);
    const frame = projectGrowthChoice(state, skillCatalog, { player: "ロッシ" });
    expect(frame).toMatchObject({
      title: "ロッシ · Lv2 スキル選択",
      summary: "現在Lv2 · 余剰XP 0 · 1つ選ぶと続行します。成長・習得は帰還時に初期化されます。",
      guaranteed: "",
      error: "",
    });
    expect(frame?.candidates.map(({ skillId }) => skillId)).toEqual(state.choice?.candidateIds);
    expect(frame?.candidates).toContainEqual(
      expect.objectContaining({
        skillId: "test-light-strike",
        detail: "新規アクティブ · 精神疲労 +0 · 戦闘",
      }),
    );
    expect(frame?.candidates).toContainEqual(
      expect.objectContaining({ skillId: "test-power", detail: "パッシブ 習得 0→1 / 上限3" }),
    );
    expect(projectGrowthChoice(state, skillCatalog, { player: "ロッシ" })).toEqual(frame);
    expect(state).toEqual(before);
  });

  it("次の現在選択でも同じパッシブが有効なら受理し、表示は強化前後のランクを示す", () => {
    const catalog: SkillCatalog = {
      ...skillCatalog,
      pools: [
        {
          id: "test-shared",
          candidates: {
            ...skillCatalog.pools[0].candidates,
            normal: ["test-power", "test-vitality", "test-light-strike"],
          },
        },
      ],
    };
    const first = reward(catalog, 20);
    const selected = chooseSkill(first, "test-power", catalog);
    if (!selected.accepted) throw new Error(selected.reason);
    const before = structuredClone(selected.state);
    expect(selected.state.choice).toMatchObject({ level: 3, status: "offered" });
    expect(projectGrowthChoice(selected.state, catalog, { player: "ロッシ" })?.candidates).toContainEqual(
      expect.objectContaining({ skillId: "test-power", detail: "パッシブ 強化 1→2 / 上限3" }),
    );
    const again = chooseSkill(selected.state, "test-power", catalog);
    expect(again).toMatchObject({ accepted: true, state: { choice: null } });
    expect(again.state.characters.find(({ characterId }) => characterId === "player")?.learned).toContainEqual(
      expect.objectContaining({ skillId: "test-power", rank: 2 }),
    );
    expect(projectGrowthChoice(again.state, catalog, { player: "ロッシ" })).toBeNull();
    expect(selected.state).toEqual(before);
  });

  it("レベル保証を表示しても現在の選択権を消費しない", () => {
    const catalog: SkillCatalog = {
      ...skillCatalog,
      characters: skillCatalog.characters.map((profile) =>
        profile.characterId === "player"
          ? { ...profile, guaranteedUnlocks: [{ skillId: "test-light-strike", level: 2 }] }
          : profile,
      ),
    };
    const state = reward(catalog);
    const before = structuredClone(state);
    expect(projectGrowthChoice(state, catalog, {})?.guaranteed).toBe("レベル保証で習得：検証用軽撃（探索中のみ）");
    expect(state.choice?.candidateIds).not.toContain("test-light-strike");
    expect(state.growth.characters.find(({ characterId }) => characterId === "player")?.pendingChoiceLevels).toEqual([
      2,
    ]);
    expect(state).toEqual(before);
  });

  it("実コアの候補不足は選択権を残した表示となり、Tabで存在しない候補へ進まない", () => {
    const catalog: SkillCatalog = {
      ...skillCatalog,
      pools: [
        {
          id: "test-shared",
          candidates: { ...skillCatalog.pools[0].candidates, normal: ["test-strike", "test-heal", "test-strength"] },
        },
      ],
      characters: skillCatalog.characters.map((profile) => ({
        ...profile,
        initialSkillIds: ["test-strike", "test-heal", "test-strength"],
      })),
      skills: skillCatalog.skills.map((skill) =>
        skill.id === "test-strength" && skill.type === "passive"
          ? { ...skill, effect: { ...skill.effect, rankAmounts: [2] } }
          : skill,
      ),
    };
    const state = reward(catalog);
    const before = structuredClone(state);
    expect(projectGrowthChoice(state, catalog, { player: "ロッシ" })).toMatchObject({
      candidates: [],
      error: "有効な3候補が不足しています。選択権利を保持したまま進行を停止しています。",
    });
    expect(
      reduceGrowthPresentation({ kind: "heading" }, { type: "key", key: "Tab", shift: false }, state.choice),
    ).toMatchObject({ handled: false });
    expect(state.growth.characters.find(({ characterId }) => characterId === "player")?.pendingChoiceLevels).toEqual([
      2,
    ]);
    expect(state).toEqual(before);
  });

  it("現在候補のfocus移動は巡回し、戻った候補への次の入力も有効でゲームは変わらない", () => {
    const state = reward();
    const before = structuredClone(state);
    const choice = state.choice;
    if (!choice) throw new Error("choice");
    const forward = { type: "key", key: "Tab", shift: false } as const;
    const backward = { type: "key", key: "Tab", shift: true } as const;
    const first = reduceGrowthPresentation({ kind: "heading" }, forward, choice);
    expect(first.focus).toEqual({ kind: "candidate", skillId: choice.candidateIds[0] });
    const last = reduceGrowthPresentation(first.focus, backward, choice);
    expect(last.focus).toEqual({ kind: "candidate", skillId: choice.candidateIds[2] });
    expect(reduceGrowthPresentation(last.focus, forward, choice).focus).toEqual(first.focus);
    expect(reduceGrowthPresentation({ kind: "heading" }, backward, choice).focus).toEqual(last.focus);
    expect(
      reduceGrowthPresentation(
        null,
        { type: "focused", target: { kind: "candidate", skillId: choice.candidateIds[1] } },
        choice,
      ),
    ).toMatchObject({ handled: true });
    expect(reduceGrowthPresentation(first.focus, { type: "key", key: "Enter", shift: false }, choice)).toMatchObject({
      handled: false,
    });
    expect(reduceGrowthPresentation(null, forward, null)).toMatchObject({ handled: false });
    expect(state).toEqual(before);
  });
});
