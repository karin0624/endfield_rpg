import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import { applyPartyStatus, type ExpeditionGame } from "../game/expedition";
import { chooseGrowthSkill, grownCharacters, rewardGrowth } from "../game/growthRuntime";
import { createParty } from "../game/party";
import { resetExplorationSkills } from "../game/skillAcquisition";
import { createCharacterDetailsModel, projectCharacterDetails, reduceCharacterDetails } from "./characterDetails";
import type { CharacterDetailsContext } from "./characterDetailsText";
import { createPartyModel } from "./partyModel";
import { projectParty } from "./partyProjection";

const game = (): ExpeditionGame => ({
  adventure: createInitialGameState(initialGameOptions),
  party: createParty(characters, ["player", "gilberta"]),
  dungeon: null,
  randomState: 731,
});
const rules = { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: growthRules };
const context = (state: ExpeditionGame): CharacterDetailsContext => ({
  characters: grownCharacters(state, rules),
  baseCharacters: characters,
  growth: state.growth,
  rules,
});

function stats(frame: NonNullable<ReturnType<typeof projectCharacterDetails>>) {
  return Object.fromEntries(frame.stats.map(([label, value, reason]) => [label, { value, reason }]));
}

describe("人物詳細の読み取り投影", () => {
  it("健康な人物は現在能力と初期習得を表示し、低下理由と疲労症状は表示しない", () => {
    const state = game();
    const before = structuredClone(state);
    const frame = projectCharacterDetails({ characters, party: state.party, context: context(state) }, "player");
    expect(frame).toBeDefined();
    if (!frame) throw new Error("人物が見つかりません");
    expect(frame).toMatchObject({
      name: "ロッシ",
      portrait: "characters/rossi/expressions/neutral.png",
      symptoms: "",
      unavailable: "",
    });
    expect(stats(frame)).toMatchObject({
      HP: { value: "20 / 20", reason: "" },
      命中率: { value: "100%", reason: "" },
      レベル: { value: "1" },
      精神疲労: { value: "0（なし）" },
    });
    expect(frame.skills.map(({ name }) => name)).toEqual(["検証用攻撃", "検証用回復"]);
    expect(state).toEqual(before);
  });

  it("肉体疲労・朦朧・精神疲労の現在値、低下理由と街での回復案内を表示する", () => {
    let state = applyPartyStatus(game(), "player", { kind: "physicalFatigue", amount: 50 }, characters);
    state = applyPartyStatus(state, "player", { kind: "haze", amount: 75 }, characters);
    state = {
      ...state,
      party: {
        ...state.party,
        members: state.party.members.map((member) =>
          member.id === "player" ? { ...member, mentalFatigue: 50, hp: 0 } : member,
        ),
      },
    };
    const before = structuredClone(state);
    const frame = projectCharacterDetails({ characters, party: state.party, context: context(state) }, "player");
    if (!frame) throw new Error("人物が見つかりません");
    expect(stats(frame)).toMatchObject({
      HP: { value: "0 / 13", reason: "基礎最大HP 20 · 症状前最大HP 20 · 肉体疲労による低下" },
      命中率: { value: "80%", reason: "基礎 100% · 朦朧による低下" },
      精神疲労: { value: "50（中度）" },
    });
    expect(frame.symptoms).toContain("肉体疲労・中度");
    expect(frame.symptoms).toContain("朦朧・重度");
    expect(frame.unavailable).toBe("戦闘に参加できません。街探索で回復を進められます。");
    expect(stats(frame).肉体疲労.reason).toBe("上限 200 · 街探索1回につき 10 回復");
    expect(state).toEqual(before);
  });

  it.each([{ initialSkillIds: null }, { initialSkillIds: [] }] as const)(
    "習得未決と明示空を区別する (%j)",
    ({ initialSkillIds }) => {
      const state = game();
      const displayContext: CharacterDetailsContext = {
        ...context(state),
        rules: {
          ...rules,
          catalog: {
            ...skillCatalog,
            characters: skillCatalog.characters.map((profile) =>
              profile.characterId === "player" ? { ...profile, initialSkillIds } : profile,
            ),
          },
        },
      };
      const frame = projectCharacterDetails({ characters, party: state.party, context: displayContext }, "player");
      expect(frame?.skills).toEqual([]);
      expect(frame?.emptySkills).toBe(initialSkillIds === null ? "習得情報は未接続です。" : "習得スキルなし");
    },
  );

  it("実報酬・成長・習得の現在値を表示し、帰還初期化後に新しい状態を読み直す", () => {
    const catalog = {
      ...skillCatalog,
      skills: skillCatalog.skills.map((skill) =>
        skill.id === "test-strength" && skill.type === "passive"
          ? { ...skill, effect: { ...skill.effect, rankAmounts: [2, 4, 6] } }
          : skill,
      ),
      pools: skillCatalog.pools.map((pool) => ({
        ...pool,
        candidates: { ...pool.candidates, normal: ["test-strength", "test-vitality", "test-power"] },
      })),
      characters: skillCatalog.characters.map((profile) => ({
        ...profile,
        guaranteedUnlocks: [{ skillId: "test-light-strike", level: 2 }],
        initialSkillIds: [...(profile.initialSkillIds ?? []), "test-strength"],
      })),
    };
    const growth = { catalog, fatigue: mentalFatigueDefinition, growth: growthRules };
    const reward = rewardGrowth(game(), { allocations: [{ characterId: "player", experience: 30 }] }, growth);
    if (!reward.accepted) throw new Error(reward.reason);
    let state: ExpeditionGame = reward.state;
    for (const skillId of ["test-strength", "test-vitality", "test-vitality"]) {
      const current = state.growth;
      if (!current?.choice) throw new Error("成長選択がありません");
      const selected = chooseGrowthSkill(state, skillId, growth);
      if (!selected.accepted) throw new Error(selected.reason);
      state = selected.state;
    }
    state = applyPartyStatus(state, "player", { kind: "physicalFatigue", amount: 25 }, characters);
    const before = structuredClone(state);
    const display = (current: ExpeditionGame) => ({
      characters: grownCharacters(current, growth),
      party: current.party,
      context: {
        characters: grownCharacters(current, growth),
        baseCharacters: characters,
        growth: current.growth,
        rules: growth,
      },
    });
    let details = reduceCharacterDetails(createCharacterDetailsModel(), {
      type: "open",
      characterId: "player",
      input: display(state),
    }).state;
    if (!details.dialog) throw new Error("人物が見つかりません");
    expect(stats(details.dialog)).toMatchObject({ レベル: { value: "4" }, 攻撃力: { value: "11" } });
    expect(stats(details.dialog).HP.reason).toContain("症状前最大HP 39（成長・パッシブ込み）");
    expect(details.dialog.skills.find(({ name }) => name === "検証用攻撃力補正")).toMatchObject({
      kind: "パッシブ · ランク 2 / 上限 3",
      notes: expect.arrayContaining(["現在の効果：通常攻撃のみの威力補正 +4"]),
    });
    expect(details.dialog.skills.find(({ name }) => name === "検証用軽撃")?.notes).toContain(
      "探索中のみ（帰還で失う） · レベル保証で習得",
    );
    expect(state).toEqual(before);
    details = reduceCharacterDetails(details, { type: "close" }).state;
    if (!state.growth) throw new Error("育成状態がありません");
    const reset = resetExplorationSkills(state.growth, growthRules.progression, catalog);
    if (!reset.accepted) throw new Error(reset.reason);
    state = { ...state, growth: reset.state };
    const resetBefore = structuredClone(state);
    details = reduceCharacterDetails(details, { type: "open", characterId: "player", input: display(state) }).state;
    if (!details.dialog) throw new Error("人物が見つかりません");
    expect(stats(details.dialog).レベル.value).toBe("1");
    expect(details.dialog.skills.find(({ name }) => name === "検証用攻撃力補正")?.kind).toBe(
      "パッシブ · ランク 1 / 上限 3",
    );
    expect(details.dialog.skills.map(({ name }) => name)).not.toContain("検証用軽撃");
    expect(details.dialog.skills.map(({ name }) => name)).not.toContain("検証用体力補正");
    expect(state).toEqual(resetBefore);
  });

  it("未提供の人物画像でも名前と能力を残し、未加入人物は詳細を開かない", () => {
    const definitions = [
      ...characters,
      { id: "guest", name: "画像のない仲間", maxHp: 200, speed: 100, attackPower: 8 },
    ];
    const party = createParty(definitions, ["guest"]);
    const frame = projectCharacterDetails({ characters: definitions, party }, "guest");
    expect(frame).toMatchObject({ name: "画像のない仲間", portrait: undefined });
    if (!frame) throw new Error("人物が見つかりません");
    expect(stats(frame).HP.value).toBe("200 / 200");
    expect(stats(frame).レベル.value).toBe("未接続");
    expect(frame.emptySkills).toBe("習得情報は未接続です。");
    expect(projectCharacterDetails({ characters: definitions, party }, "player")).toBeUndefined();
    expect(
      reduceCharacterDetails(createCharacterDetailsModel(), {
        type: "open",
        characterId: "player",
        input: { characters: definitions, party },
      }).handled,
    ).toBe(false);
  });

  it("閉じて開き直せば閉じる入力も再受理し、退出後/旧画像の失敗は新表示を変えない", () => {
    const state = game();
    const input = { characters, party: state.party };
    let details = reduceCharacterDetails(createCharacterDetailsModel(), {
      type: "open",
      characterId: "player",
      input,
    }).state;
    const oldRequest = details.generation;
    details = reduceCharacterDetails(details, { type: "close" }).state;
    expect(details.focus).toEqual({ kind: "opener", characterId: "player" });
    expect(reduceCharacterDetails(details, { type: "close" }).handled).toBe(false);
    details = reduceCharacterDetails(details, { type: "open", characterId: "gilberta", input }).state;
    details = reduceCharacterDetails(details, { type: "portrait-failed", generation: oldRequest }).state;
    expect(details.dialog).toMatchObject({ name: "ギルベルタ", portraitFailed: false });
    details = reduceCharacterDetails(details, { type: "portrait-failed", generation: details.generation }).state;
    expect(details.dialog?.portraitFailed).toBe(true);
    details = reduceCharacterDetails(details, { type: "key", key: "Escape", shift: false }).state;
    expect(details.dialog).toBeNull();
    expect(details.focus).toEqual({ kind: "opener", characterId: "gilberta" });
    details = reduceCharacterDetails(details, { type: "disposed" }).state;
    expect(reduceCharacterDetails(details, { type: "open", characterId: "player", input }).handled).toBe(false);
    expect(reduceCharacterDetails(details, { type: "portrait-failed", generation: oldRequest }).handled).toBe(false);
  });

  it("詳細の focus と読み取り位置は明示状態へ反映し、通常キーは native 操作へ渡す", () => {
    const state = game();
    const before = structuredClone(state);
    let details = reduceCharacterDetails(createCharacterDetailsModel(), {
      type: "open",
      characterId: "player",
      input: { characters, party: state.party },
    }).state;
    details = reduceCharacterDetails(details, { type: "focused", target: { kind: "back" } }).state;
    details = reduceCharacterDetails(details, { type: "focused", target: { kind: "information" } }).state;
    details = reduceCharacterDetails(details, { type: "scrolled", scrollTop: 120 }).state;
    details = reduceCharacterDetails(details, { type: "scrolled", scrollTop: 120 }).state;
    expect(details.focus).toEqual({ kind: "information" });
    expect(details.scrollTop).toBe(120);
    expect(reduceCharacterDetails(details, { type: "key", key: " ", shift: false }).handled).toBe(false);
    expect(
      reduceCharacterDetails(details, {
        type: "open",
        characterId: "gilberta",
        input: { characters, party: state.party },
      }).handled,
    ).toBe(false);
    details = reduceCharacterDetails(details, { type: "key", key: "Tab", shift: false }).state;
    expect(details.focus).toEqual({ kind: "back" });
    expect(state).toEqual(before);
  });

  it("全快・半分・空・症状後最大HPの比率と症状表示は現在値から投影する", () => {
    const definitions = [
      ...characters.map((character) => ({ ...character, maxHp: 20 })),
      { id: "empty", name: "空", maxHp: 20, speed: 100, attackPower: 8 },
      { id: "fatigued", name: "疲労", maxHp: 20, speed: 100, attackPower: 8 },
    ];
    let source: ExpeditionGame = {
      ...game(),
      party: createParty(
        definitions,
        definitions.map(({ id }) => id),
      ),
    };
    source = applyPartyStatus(source, "fatigued", { kind: "physicalFatigue", amount: 50 }, definitions);
    const hp: Record<string, number> = { player: 20, gilberta: 10, empty: 0, fatigued: 6.5 };
    source = {
      ...source,
      party: {
        slots: ["player", "gilberta", "empty", "fatigued"],
        members: source.party.members.map((member) => ({ ...member, hp: hp[member.id] })),
      },
    };
    const before = structuredClone(source);
    const frame = projectParty(
      createPartyModel({ game: source, characters: definitions, calendarLabel: "1日目 · 昼" }, "home"),
    );
    expect(frame.slots.map(({ member }) => member?.hp)).toEqual(["HP 20/20", "HP 10/20", "HP 0/20", "HP 6.5/13"]);
    expect(frame.slots.map(({ member }) => member?.ratio)).toEqual([1, 0.5, 0, 0.5]);
    expect(frame.slots[3].member?.symptoms).toBe("肉体疲労・中度");
    expect(source).toEqual(before);
  });
});
