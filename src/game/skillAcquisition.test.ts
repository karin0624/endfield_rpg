import { describe, expect, it } from "vitest";
import { skillCatalog } from "../content/skillDefinitions";
import { createGameRandom } from "./gameRandom";
import type { ProgressionDefinition } from "./progression";
import {
  type AcquisitionResult,
  chooseSkill,
  createExplorationSkills,
  type ExplorationSkills,
  grantSkillExperience,
  prepareSkillChoice,
  resetExplorationSkills,
} from "./skillAcquisition";
import {
  type ActiveSkillDefinition,
  activeSkillBaseAmount,
  type PassiveSkillDefinition,
  passiveSkillAmount,
  type SkillCatalog,
  type SkillDefinition,
  skillById,
  validateSkillCatalog,
} from "./skills";

// All values are test fixtures, not character balance or an adopted unlock table.
const strike = skillById(skillCatalog, "test-strike") as ActiveSkillDefinition;
const heal = skillById(skillCatalog, "test-heal") as ActiveSkillDefinition;
const strength = skillById(skillCatalog, "test-strength") as PassiveSkillDefinition;
const extra: readonly SkillDefinition[] = [
  { ...strike, id: "extra", effect: { ...strike.effect, amount: 5 } },
  { ...strike, id: "required" },
  {
    ...strength,
    id: "long-passive",
    effect: { type: "basic-attack-power-bonus", rankAmounts: [1, 4, 9] },
  },
];
const catalog: SkillCatalog = {
  ...skillCatalog,
  skills: [...skillCatalog.skills, ...extra],
  pools: [
    {
      id: "test-shared",
      candidates: {
        ...skillCatalog.pools[0].candidates,
        normal: ["test-strike", "test-heal", "test-strength", "extra", "required", "long-passive"],
      },
    },
  ],
  characters: [
    {
      characterId: "player",
      poolId: "test-shared",
      initialSkillIds: ["test-strength"],
      guaranteedUnlocks: [{ skillId: "required", level: 5 }],
    },
    { characterId: "gilberta", poolId: "test-shared", initialSkillIds: [] },
  ],
};
function progression(playerLevel = 4, gilbertaLevel = 9): ProgressionDefinition {
  return {
    initial: [
      { characterId: "player", level: playerLevel, experience: 0, bonus: { maxHp: 0, attackPower: 0 } },
      { characterId: "gilberta", level: gilbertaLevel, experience: 0, bonus: { maxHp: 0, attackPower: 0 } },
    ],
    rules: Array.from({ length: 15 }, (_, index) => ({
      fromLevel: index + 1,
      requiredExperience: 10,
      bonus: { maxHp: 1, attackPower: 1 },
    })),
  };
}
function accepted(result: AcquisitionResult): ExplorationSkills {
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
function start(definition = progression(), skills = catalog): ExplorationSkills {
  return createExplorationSkills("run-1", createGameRandom(1), definition, skills);
}
function reward(
  state: ExplorationSkills,
  experience: number,
  definition = progression(),
  skills = catalog,
  characterId = "player",
  id = "reward-1",
): ExplorationSkills {
  return accepted(
    grantSkillExperience(state, "run-1", { id, allocations: [{ characterId, experience }] }, definition, skills),
  );
}
function select(
  state: ExplorationSkills,
  skillId = state.choice?.candidateIds[0],
  skills = catalog,
): ExplorationSkills {
  if (!state.choice || !skillId) throw new Error("選択候補がありません");
  return accepted(
    chooseSkill(
      state,
      { explorationId: "run-1", characterId: state.choice.characterId, level: state.choice.level, skillId },
      skills,
    ),
  );
}

describe("探索内スキル取得コア", () => {
  it("複数キャラのLv4→6とLv9→11を各到達レベルで順に解決し、権利を消費する", () => {
    const definition = progression();
    let state = accepted(
      grantSkillExperience(
        start(),
        "run-1",
        {
          id: "both",
          allocations: [
            { characterId: "gilberta", experience: 20 },
            { characterId: "player", experience: 20 },
          ],
        },
        definition,
        catalog,
      ),
    );
    expect(state.choice).toMatchObject({ characterId: "player", level: 5 });
    expect(state.choice?.candidateIds.slice().sort()).toEqual([
      "test-heal-advanced",
      "test-strength-advanced",
      "test-strike-advanced",
    ]);
    state = select(state);
    expect(state.choice).toMatchObject({ characterId: "player", level: 6 });
    expect(state.choice?.candidateIds.every((id) => !id.includes("advanced") && !id.includes("ultimate"))).toBe(true);
    state = select(state);
    expect(state.choice).toMatchObject({ characterId: "gilberta", level: 10 });
    expect(state.choice?.candidateIds.slice().sort()).toEqual([
      "test-heal-ultimate",
      "test-strength-ultimate",
      "test-strike-ultimate",
    ]);
    state = select(state);
    expect(state.choice).toMatchObject({ characterId: "gilberta", level: 11 });
    state = select(state);
    expect(state.choice).toBeNull();
    expect(state.growth.characters.map(({ pendingChoiceLevels }) => pendingChoiceLevels)).toEqual([[], []]);
    expect(
      state.characters.map(({ learned }) => learned.filter(({ acquisition }) => acquisition === "choice").length),
    ).toEqual([2, 2]);
    expect(grantSkillExperience(state, "run-1", { id: "both", allocations: [] }, definition, catalog)).toMatchObject({
      accepted: false,
      reason: "reward-already-applied",
      state,
    });
  });
  it("途中レベルの保証を抽選前に付与し、保証前も抽選に混ぜず選択権利は残す", () => {
    const definition = progression(1, 1);
    let state = reward(start(definition), 10, definition);
    expect(state.choice?.candidateIds).not.toContain("required");
    expect(state.characters[0].learned.some(({ skillId }) => skillId === "required")).toBe(false);
    state = select(state);
    state = reward(state, 40, definition, catalog, "player", "cross-levels");
    expect(state.characters[0].learned.filter(({ skillId }) => skillId === "required")).toEqual([
      { skillId: "required", type: "active", origin: "expedition", acquisition: "guaranteed" },
    ]);
    expect(state.growth.characters[0].pendingChoiceLevels).toEqual([3, 4, 5, 6]);
    expect(state.choice?.candidateIds).not.toContain("required");
  });
  it("同レベル保証でも新規アクティブ／パッシブの3択を消さない", () => {
    const skills: SkillCatalog = {
      ...catalog,
      characters: [
        { ...catalog.characters[0], guaranteedUnlocks: [{ skillId: "required", level: 2 }] },
        catalog.characters[1],
      ],
    };
    const definition = progression(1, 1);
    const state = reward(start(definition, skills), 10, definition, skills);
    expect(state.choice).toMatchObject({ level: 2, status: "offered" });
    expect(state.choice?.candidateIds).toHaveLength(3);
    expect(state.choice?.candidateIds).not.toContain("required");
    expect(state.characters[0].learned.some(({ skillId }) => skillId === "required")).toBe(true);
  });
  it("固定seedの候補を保持し、参照・再準備・無効入力で再抽選しない", () => {
    const definition = progression(1, 1);
    const state = reward(start(definition), 10, definition);
    // Independent LCG example: seed 1 produces indices 1,1,1 in shrinking lists of 5,4,3.
    expect(state.choice?.candidateIds).toEqual(["test-heal", "test-strength", "extra"]);
    expect(state.randomState).toBe(2165703038);
    const before = structuredClone(state);
    expect(prepareSkillChoice(state, catalog)).toEqual(before);
    expect(state).toEqual(before);
    for (const input of [
      { explorationId: "old-run", characterId: "player", level: 2, skillId: "test-heal" },
      { explorationId: "run-1", characterId: "gilberta", level: 2, skillId: "test-heal" },
      { explorationId: "run-1", characterId: "player", level: 3, skillId: "test-heal" },
      { explorationId: "run-1", characterId: "player", level: 2, skillId: "required" },
    ]) {
      expect(chooseSkill(state, input, catalog)).toMatchObject({ accepted: false, state: before });
      expect(state).toEqual(before);
    }
    expect(
      grantSkillExperience(
        state,
        "run-1",
        { id: "next", allocations: [{ characterId: "player", experience: 10 }] },
        definition,
        catalog,
      ),
    ).toMatchObject({ accepted: false, reason: "pending-choice", state: before });
    expect(state).toEqual(before);
  });
  it("新規アクティブはランクなしで1回だけ取得でき、次の候補と二重入力から除外する", () => {
    const definition = progression(1, 1);
    const first = reward(start(definition), 10, definition);
    let state = select(first, "test-heal");
    expect(state.characters[0].learned.find(({ skillId }) => skillId === "test-heal")).toEqual({
      skillId: "test-heal",
      type: "active",
      acquisition: "choice",
      origin: "expedition",
    });
    expect(
      chooseSkill(state, { explorationId: "run-1", characterId: "player", level: 2, skillId: "test-heal" }, catalog),
    ).toMatchObject({ accepted: false, state });
    state = reward(state, 10, definition, catalog, "player", "next");
    expect(state.choice?.candidateIds).not.toContain("test-heal");
  });
  it("初期パッシブを強化し、個別上限の到達後は候補から除外する", () => {
    const definition = progression(1, 1);
    let state = select(reward(start(definition), 10, definition), "test-strength");
    expect(state.characters[0].learned.find(({ skillId }) => skillId === "test-strength")).toMatchObject({
      type: "passive",
      rank: 2,
      origin: "initial",
      acquisition: "initial",
    });
    state = reward(state, 10, definition, catalog, "player", "next");
    expect(state.choice?.candidateIds).not.toContain("test-strength");
  });
  it("ランク3のパッシブを新規習得から各段階強化まで扱う", () => {
    const definition = progression(1, 1);
    const skills: SkillCatalog = {
      ...catalog,
      pools: [
        {
          id: "test-shared",
          candidates: { ...catalog.pools[0].candidates, normal: ["test-strike", "test-heal", "long-passive"] },
        },
      ],
    };
    let state = start(definition, skills);
    for (const [id, rank, amount] of [
      ["a", 1, 1],
      ["b", 2, 4],
      ["c", 3, 9],
    ] as const) {
      state = select(reward(state, 10, definition, skills, "player", id), "long-passive", skills);
      expect(state.characters[0].learned.find(({ skillId }) => skillId === "long-passive")).toMatchObject({
        type: "passive",
        rank,
      });
      const skill = skills.skills.find(({ id }) => id === "long-passive");
      if (skill?.type !== "passive") throw new Error("パッシブ定義なし");
      expect(passiveSkillAmount(skill, rank)).toBe(amount);
    }
  });
  it.each([0, 1, 2])("有効候補%s件は権利とRNGを保持した不足になり、スキップしない", (remaining) => {
    const definition = progression(1, 1);
    const initialIds = ["test-strike", "test-heal", "test-strength"].slice(remaining);
    const skills: SkillCatalog = {
      ...skillCatalog,
      pools: [
        {
          id: "test-shared",
          candidates: { ...skillCatalog.pools[0].candidates, normal: ["test-strike", "test-heal", "test-strength"] },
        },
      ],
      skills: skillCatalog.skills.map((skill) =>
        skill.type === "passive" ? { ...skill, effect: { ...skill.effect, rankAmounts: [2] } } : skill,
      ),
      characters: [
        { characterId: "player", poolId: "test-shared", initialSkillIds: initialIds },
        { characterId: "gilberta", poolId: "test-shared", initialSkillIds: [] },
      ],
    };
    const state = reward(start(definition, skills), 10, definition, skills);
    expect(state.choice).toEqual({
      characterId: "player",
      level: 2,
      candidateIds: [],
      status: "insufficient-candidates",
    });
    expect(state.randomState).toBe(1);
    expect(state.growth.characters[0].pendingChoiceLevels).toEqual([2]);
    expect(prepareSkillChoice(state, skills)).toEqual(state);
    expect(
      chooseSkill(state, { explorationId: "run-1", characterId: "player", level: 2, skillId: "test-strike" }, skills),
    ).toMatchObject({ accepted: false, reason: "wrong-choice", state });
  });
  it("初期化で保証・抽選・強化・権利を除き、初期能力と初期パッシブに戻す", () => {
    const definition = progression(1, 1);
    let state = select(reward(start(definition), 10, definition), "test-strength");
    state = reward(state, 30, definition, catalog, "player", "to-five");
    const rng = state.randomState;
    state = accepted(resetExplorationSkills(state, "run-1", definition, catalog));
    expect(state.characters[0].learned).toEqual([
      { skillId: "test-strength", type: "passive", rank: 1, origin: "initial", acquisition: "initial" },
    ]);
    expect(state.growth.characters[0]).toMatchObject({
      level: 1,
      experience: 0,
      bonus: { maxHp: 0, attackPower: 0 },
      pendingChoiceLevels: [],
    });
    expect(state.choice).toBeNull();
    expect(state.randomState).toBe(rng);
    expect(state.growth.appliedRewardIds).toEqual(["reward-1", "to-five"]);
    expect(
      chooseSkill(state, { explorationId: "run-1", characterId: "player", level: 3, skillId: "extra" }, catalog),
    ).toMatchObject({ accepted: false, reason: "closed-exploration", state });
    const next = createExplorationSkills("run-2", state.randomState, definition, catalog);
    expect(next.randomState).toBe(rng);
    expect(
      chooseSkill(next, { explorationId: "run-1", characterId: "player", level: 2, skillId: "test-strength" }, catalog),
    ).toMatchObject({ accepted: false, reason: "wrong-exploration", state: next });
  });
  it("未決定の初期定義を空習得へ変換せず、解禁漏れになる初期レベルを拒否する", () => {
    expect(() =>
      start(progression(), {
        ...skillCatalog,
        characters: skillCatalog.characters.map((profile) => ({ ...profile, initialSkillIds: null })),
      }),
    ).toThrow("初期スキル定義が未接続");
    expect(() => start(progression(5))).toThrow("保証解禁レベル");
  });
  it("成長対象の部分集合へ全キャラのカタログを再利用できる", () => {
    const full = progression(1, 1);
    const definition = { ...full, initial: full.initial.slice(0, 1) };
    const state = reward(start(definition), 10, definition);
    expect(state.characters.map(({ characterId }) => characterId)).toEqual(["player"]);
    expect(state.choice).toMatchObject({ characterId: "player", level: 2 });
  });
  it("抽選アクティブも初期化で消え、初期アクティブはランクなしで戻る", () => {
    const definition = progression(1, 1);
    const skills: SkillCatalog = {
      ...catalog,
      characters: [
        { ...catalog.characters[0], initialSkillIds: ["test-strike", "test-strength"] },
        catalog.characters[1],
      ],
    };
    let state = reward(start(definition, skills), 10, definition, skills);
    state = select(state, "test-heal", skills);
    state = accepted(resetExplorationSkills(state, "run-1", definition, skills));
    expect(state.characters[0].learned).toEqual([
      { skillId: "test-strike", type: "active", origin: "initial", acquisition: "initial" },
      { skillId: "test-strength", type: "passive", origin: "initial", acquisition: "initial", rank: 1 },
    ]);
  });
  it("不正報酬は保証や候補生成も行わない", () => {
    const state = start();
    expect(
      grantSkillExperience(
        state,
        "run-1",
        { id: "bad", allocations: [{ characterId: "missing", experience: 20 }] },
        progression(),
        catalog,
      ),
    ).toMatchObject({ accepted: false, reason: "unknown-character", state });
  });
});

describe("ランクを持たない能力値依存効果と個別パッシブ定義", () => {
  it("参照能力値で基礎効果だけが伸び、疲労増加量を変えない", () => {
    expect(activeSkillBaseAmount(strike, { attackPower: 8, maxHp: 20 })).toBe(16);
    expect(activeSkillBaseAmount(strike, { attackPower: 12, maxHp: 20 })).toBe(18);
    expect(activeSkillBaseAmount(heal, { attackPower: 8, maxHp: 20 })).toBe(18);
    expect(
      activeSkillBaseAmount(
        { ...strike, effect: { type: "damage", amount: 0.25, scaling: { stat: "attackPower", coefficient: 0.5 } } },
        { attackPower: 1.25, maxHp: 20 },
      ),
    ).toBe(0.875);
    expect(strike.mentalFatigueIncrease).toBe(4);
  });
  it("個別上限と非一律の段階効果を持ち、範囲外ランクを拒否する", () => {
    expect(passiveSkillAmount(strength, 2)).toBe(4);
    for (const rank of [0, -1, 1.5, Number.NaN, 3]) expect(() => passiveSkillAmount(strength, rank)).toThrow();
    const long = extra[2];
    if (long.type !== "passive") throw new Error("パッシブ定義なし");
    expect(passiveSkillAmount(long, 3)).toBe(9);
  });
  it.each([
    ...[1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1].map((level) => ({ skillId: "required", level })),
    { skillId: "missing", level: 2 },
    { skillId: "test-strength", level: 2 },
  ])("不正な保証定義を拒否する %j", (unlock) => {
    expect(() =>
      validateSkillCatalog({ ...catalog, characters: [{ ...catalog.characters[0], guaranteedUnlocks: [unlock] }] }, [
        { id: "player" },
      ]),
    ).toThrow();
  });
});

describe("追加の定義検証", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("不正な能力値係数%sを拒否する", (coefficient) => {
    expect(() =>
      validateSkillCatalog(
        {
          ...catalog,
          skills: catalog.skills.map((skill) =>
            skill.id === "test-strike"
              ? { ...strike, effect: { ...strike.effect, scaling: { stat: "attackPower" as const, coefficient } } }
              : skill,
          ),
        },
        [{ id: "player" }, { id: "gilberta" }],
      ),
    ).toThrow("能力値係数");
  });
  it("空のパッシブ上限と保証解禁の重複を拒否する", () => {
    expect(() =>
      validateSkillCatalog(
        {
          ...catalog,
          skills: catalog.skills.map((skill) =>
            skill.type === "passive" ? { ...skill, effect: { ...skill.effect, rankAmounts: [] } } : skill,
          ),
        },
        [{ id: "player" }, { id: "gilberta" }],
      ),
    ).toThrow("パッシブ上限");
    expect(() =>
      validateSkillCatalog(
        {
          ...catalog,
          characters: [
            {
              ...catalog.characters[0],
              guaranteedUnlocks: [
                { skillId: "required", level: 5 },
                { skillId: "required", level: 6 },
              ],
            },
          ],
        },
        [{ id: "player" }],
      ),
    ).toThrow("重複");
    expect(() =>
      validateSkillCatalog({ ...catalog, characters: [{ ...catalog.characters[0], initialSkillIds: ["required"] }] }, [
        { id: "player" },
      ]),
    ).toThrow("初期と保証解禁");
  });
});

it("通常パッシブのランク2は上位分類の候補へ移らない", () => {
  const definition = progression(2, 1);
  const skills: SkillCatalog = {
    ...catalog,
    pools: [
      {
        id: "test-shared",
        candidates: { ...catalog.pools[0].candidates, normal: ["test-strike", "test-heal", "long-passive"] },
      },
    ],
  };
  let state = start(definition, skills);
  for (const id of ["first", "second"])
    state = select(reward(state, 10, definition, skills, "player", id), "long-passive", skills);
  expect(state.characters[0].learned).toContainEqual({
    skillId: "long-passive",
    type: "passive",
    origin: "expedition",
    acquisition: "choice",
    rank: 2,
  });
  state = reward(state, 10, definition, skills, "player", "advanced");
  expect(state.choice?.level).toBe(5);
  expect([...(state.choice?.candidateIds ?? [])].sort()).toEqual([
    "test-heal-advanced",
    "test-strength-advanced",
    "test-strike-advanced",
  ]);
  expect(state.characters[0].learned.find(({ skillId }) => skillId === "long-passive")).toMatchObject({ rank: 2 });
});
