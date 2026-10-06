import { describe, expect, it } from "vitest";
import { initialAdventure } from "../content/initialAdventure";
import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "../game/createInitialGameState";
import savedAdventure from "../web/adventure-settings.json";
import savedBattle from "../web/battle-settings.json";
import { createAdventureEditorModel, projectAdventureEditor, reduceAdventureEditor } from "./adventureEditorModel";
import { createAdventureEditorPreview } from "./adventureModel";
import { projectAdventure } from "./adventureProjection";
import { parseAdventureSettings } from "./adventureSettings";
import { createBattleEditorModel, projectBattleEditor, reduceBattleEditor } from "./battleEditorModel";
import { parseBattleSettings } from "./battleSettings";

const battle = parseBattleSettings(savedBattle),
  adventure = parseAdventureSettings(savedAdventure);

describe("開発設定の現在値と保存結果", () => {
  it("構図の全20入力を同期検証し、有効な値と書出し値を独立した変更値へ投影する", () => {
    const changes = {
      cameraX: 1,
      cameraY: 8,
      cameraZ: 13,
      targetX: 2,
      targetY: 3,
      targetZ: -10,
      fovDegrees: 40,
      groundScale: 1.1,
      backdropScale: 1.15,
      backdropX: 2,
      backdropY: 7,
      backdropZ: -10,
      allyCenterX: 4,
      allyCenterZ: 2,
      allyStepX: -2,
      allyStepZ: 1,
      enemyCenterX: -4,
      enemyCenterZ: 1,
      enemyStepX: 2,
      enemyStepZ: 2,
    } as const;
    for (const key of Object.keys(changes) as (keyof typeof changes)[]) {
      const initial = createBattleEditorModel(battle),
        before = structuredClone(initial);
      const changed = reduceBattleEditor(initial, { type: "field", key, raw: String(changes[key]) });
      expect(initial).toEqual(before);
      expect(changed.state.current).toEqual({ ...battle, [key]: changes[key] });
      expect(projectBattleEditor(changed.state)).toMatchObject({ canSave: true, raw: { [key]: String(changes[key]) } });
      const exported = reduceBattleEditor(changed.state, { type: "export" }).effects[0];
      if (exported.type !== "export") throw new Error("公開書出し結果を取得すること");
      expect(JSON.parse(exported.json)).toEqual({ ...battle, [key]: changes[key] });
    }
  });

  it("空欄・複数の不正数値・構図の交差制約を保持し、最後の有効previewを壊さない", () => {
    let state = createBattleEditorModel(battle);
    state = reduceBattleEditor(state, { type: "field", key: "cameraY", raw: "" }).state;
    state = reduceBattleEditor(state, { type: "field", key: "groundScale", raw: "0" }).state;
    state = reduceBattleEditor(state, { type: "field", key: "cameraX", raw: "1" }).state;
    expect(state.current).toEqual(battle);
    expect(state.raw).toMatchObject({ cameraY: "", groundScale: "0", cameraX: "1" });
    expect([...state.invalid].sort()).toEqual(["cameraY", "groundScale"]);
    expect(projectBattleEditor(state)).toMatchObject({ canSave: false, canExport: false, error: true });
    expect(reduceBattleEditor(state, { type: "save" }).handled).toBe(false);
    expect(reduceBattleEditor(state, { type: "export" }).handled).toBe(false);
    state = reduceBattleEditor(state, { type: "field", key: "cameraY", raw: "8" }).state;
    expect(projectBattleEditor(state).canSave).toBe(false);
    state = reduceBattleEditor(state, { type: "field", key: "groundScale", raw: "1.1" }).state;
    expect(state.current).toEqual({ ...battle, cameraY: 8, cameraX: 1, groundScale: 1.1 });
    expect(projectBattleEditor(state).canSave).toBe(true);
    state = reduceBattleEditor(state, { type: "field", key: "cameraZ", raw: "-15" }).state;
    expect(projectBattleEditor(state).canSave).toBe(false);
    state = reduceBattleEditor(state, { type: "revert" }).state;
    expect(state.current).toEqual(battle);
    expect(projectBattleEditor(state).canSave).toBe(true);
    for (const [key, raw] of [
      ["allyStepX", "0"],
      ["allyStepZ", "0"],
    ] as const)
      state = reduceBattleEditor(state, { type: "field", key, raw }).state;
    expect(projectBattleEditor(state)).toMatchObject({ canSave: false, error: true });
    expect(projectBattleEditor(state).message).toContain("重ならない");
  });

  it("接地待ち・範囲外では保存せず、失敗後再試行と保存済み値を同期確定する", () => {
    let state = reduceBattleEditor(createBattleEditorModel(battle), { type: "field", key: "cameraY", raw: "8" }).state;
    state = reduceBattleEditor(state, { type: "grounding", pending: true, measurements: [] }).state;
    expect(projectBattleEditor(state)).toMatchObject({
      canSave: false,
      message: "配置を反映しました。接地を確認しています…",
    });
    state = reduceBattleEditor(state, {
      type: "grounding",
      pending: false,
      measurements: [{ id: "player", groundY: null }],
    }).state;
    expect(projectBattleEditor(state)).toMatchObject({ canSave: false, error: true });
    state = reduceBattleEditor(state, {
      type: "grounding",
      pending: false,
      measurements: [{ id: "player", groundY: 0 }],
    }).state;
    const issued = reduceBattleEditor(state, { type: "save" });
    state = issued.state;
    expect(issued.effects).toEqual([{ type: "save", settings: { ...battle, cameraY: 8 } }]);
    expect(projectBattleEditor(state)).toMatchObject({ canSave: false, inputsEnabled: false });
    expect(reduceBattleEditor(state, { type: "field", key: "cameraY", raw: "9" }).handled).toBe(false);
    expect(reduceBattleEditor(state, { type: "revert" }).handled).toBe(false);
    state = reduceBattleEditor(state, { type: "save-failed", message: "書込み失敗" }).state;
    expect(state.saved).toEqual(battle);
    expect(projectBattleEditor(state)).toMatchObject({ canSave: true, error: true, message: "書込み失敗" });
    state = reduceBattleEditor(state, { type: "save" }).state;
    const completed = reduceBattleEditor(state, { type: "save-success", message: "標準として保存しました" });
    expect(completed.state.saved).toEqual({ ...battle, cameraY: 8 });
    expect(completed.effects).toEqual([{ type: "delete-draft" }]);
  });

  it("構図draft復元・破損・Storage障害を分け、preview復帰と現在focusを投影する", () => {
    const initial = createBattleEditorModel(battle);
    let state = reduceBattleEditor(initial, {
      type: "draft-read",
      available: true,
      value: JSON.stringify({ ...battle, cameraY: 12 }),
    }).state;
    expect(state.current.cameraY).toBe(12);
    expect(state.saved.cameraY).toBe(6.6);
    expect(projectBattleEditor(state).message).toContain("復元");
    for (const value of ["{", JSON.stringify({ ...battle, version: 1, cameraY: 7 })]) {
      const rejected = reduceBattleEditor(initial, { type: "draft-read", available: true, value });
      expect(rejected.state.current).toEqual(battle);
      expect(rejected.state.saved).toEqual(battle);
      expect(rejected.effects).toEqual([{ type: "preview-settings", settings: battle }]);
    }
    state = reduceBattleEditor(initial, { type: "draft-read", available: false, value: null }).state;
    state = reduceBattleEditor(state, { type: "field", key: "cameraY", raw: "8" }).state;
    expect(projectBattleEditor(state).message).toContain("一時保存が使えない");
    const changed = reduceBattleEditor(initial, { type: "field", key: "cameraY", raw: "8" }).state;
    expect(projectBattleEditor(reduceBattleEditor(changed, { type: "storage-failed" }).state).message).toContain(
      "一時保存が使えない",
    );
    state = reduceBattleEditor(state, { type: "preview" }).state;
    expect(state).toMatchObject({ preview: true, focus: { kind: "preview-back" } });
    expect(reduceBattleEditor(state, { type: "key", key: "Tab", shift: false })).toMatchObject({
      handled: false,
      state: { focus: null },
    });
    state = reduceBattleEditor(state, { type: "preview-back" }).state;
    expect(state).toMatchObject({ preview: false, focus: { kind: "preview" } });
    state = reduceBattleEditor(state, { type: "key", key: "Tab", shift: false }).state;
    expect(state.focus).toEqual({ kind: "save" });
    state = reduceBattleEditor(state, { type: "focused", target: { kind: "ally-count" } }).state;
    state = reduceBattleEditor(state, { type: "count", team: "ally", count: 1 }).state;
    expect(state.counts).toEqual({ ally: 1, enemy: 2 });
    state = reduceBattleEditor(state, { type: "blurred", target: { kind: "preview" } }).state;
    expect(state.focus).toEqual({ kind: "ally-count" });
    state = reduceBattleEditor(state, { type: "blurred", target: { kind: "ally-count" } }).state;
    expect(state.focus).toBeNull();
    state = reduceBattleEditor(state, { type: "closed" }).state;
    expect(reduceBattleEditor(state, { type: "save-success", message: "遅い応答" }).handled).toBe(false);
    expect(projectBattleEditor(state).canSave).toBe(false);
  });

  it("会話の全24入力は独立した変更値を保存・previewへ渡し、不正な別フィールドを消さない", () => {
    const changes = {
      leftX: 22,
      centerX: 52,
      rightX: 78,
      portraitBottom: 5,
      portraitHeight: 90,
      mobileLeftX: 24,
      mobileCenterX: 52,
      mobileRightX: 77,
      mobilePortraitBottom: 9,
      mobilePortraitHeight: 70,
      panelHeight: 30,
      mobilePanelHeight: 32,
      panelPaddingX: 9,
      mobilePanelPaddingX: 8,
      panelPaddingTop: 30,
      mobilePanelPaddingTop: 28,
      speakerGap: 10,
      textGap: 20,
      arrowRight: 10,
      arrowBottom: 24,
      choicesTop: 42,
      choicesWidth: 80,
      mobileChoicesTop: 46,
      mobileChoicesWidth: 92,
    } as const;
    for (const key of Object.keys(changes) as (keyof typeof changes)[]) {
      const changed = reduceAdventureEditor(createAdventureEditorModel(adventure), {
        type: "field",
        key,
        raw: String(changes[key]),
      });
      expect(changed.state.current).toEqual({ ...adventure, [key]: changes[key] });
      expect(projectAdventureEditor(changed.state)).toMatchObject({
        canSave: true,
        raw: { [key]: String(changes[key]) },
      });
      expect(reduceAdventureEditor(changed.state, { type: "save" }).effects).toEqual([
        { type: "save", settings: { ...adventure, [key]: changes[key] } },
      ]);
    }
    let state = reduceAdventureEditor(createAdventureEditorModel(adventure), {
      type: "field",
      key: "leftX",
      raw: "",
    }).state;
    state = reduceAdventureEditor(state, { type: "field", key: "rightX", raw: "101" }).state;
    state = reduceAdventureEditor(state, { type: "field", key: "panelPaddingTop", raw: "30" }).state;
    expect(state.current).toEqual(adventure);
    expect(state.invalid).toEqual(["leftX", "rightX"]);
    expect(projectAdventureEditor(state)).toMatchObject({ canSave: false, error: true });
    state = reduceAdventureEditor(state, { type: "field", key: "leftX", raw: "22" }).state;
    expect(projectAdventureEditor(state).canSave).toBe(false);
    state = reduceAdventureEditor(state, { type: "field", key: "rightX", raw: "78" }).state;
    expect(state.current).toEqual({ ...adventure, leftX: 22, rightX: 78, panelPaddingTop: 30 });
  });

  it("会話保存中のrevertと応答を別の状態として確定し、最新draftを失わない", () => {
    let state = reduceAdventureEditor(createAdventureEditorModel(adventure), {
      type: "field",
      key: "leftX",
      raw: "22",
    }).state;
    const issued = reduceAdventureEditor(state, { type: "save" });
    state = issued.state;
    expect(issued.effects).toEqual([{ type: "save", settings: { ...adventure, leftX: 22 } }]);
    const edited = reduceAdventureEditor(state, { type: "field", key: "leftX", raw: "24" });
    expect(edited.handled).toBe(true);
    expect(edited.state.current.leftX).toBe(24);
    expect(projectAdventureEditor(edited.state).inputsEnabled).toBe(true);
    state = edited.state;
    state = reduceAdventureEditor(state, { type: "revert" }).state;
    expect(state.current).toEqual(adventure);
    const completed = reduceAdventureEditor(state, { type: "save-success", message: "標準として保存しました" });
    expect(completed.state.saved).toEqual({ ...adventure, leftX: 22 });
    expect(completed.state.current).toEqual(adventure);
    expect(completed.effects).toEqual([{ type: "write-draft", settings: adventure }]);
    const next = reduceAdventureEditor(completed.state, { type: "revert" }).state;
    expect(next.current.leftX).toBe(22);
    const saving = reduceAdventureEditor(next, { type: "save" }).state;
    expect(reduceAdventureEditor(saving, { type: "save-success", message: "保存" }).effects).toEqual([
      { type: "delete-draft" },
    ]);
    const failed = reduceAdventureEditor(saving, { type: "save-failed", message: "容量不足" }).state;
    expect(failed.saved.leftX).toBe(22);
    expect(projectAdventureEditor(failed)).toMatchObject({ canSave: true, error: true, message: "容量不足" });
    expect(reduceAdventureEditor(failed, { type: "save" }).handled).toBe(true);
  });

  it("会話draft障害・preview復帰・nativefocusの離脱と所有終了を意味状態へ移す", () => {
    const initial = createAdventureEditorModel(adventure);
    const restored = reduceAdventureEditor(initial, {
      type: "draft-read",
      available: true,
      value: JSON.stringify({ ...adventure, leftX: 22 }),
    }).state;
    expect(restored.current.leftX).toBe(22);
    expect(restored.saved.leftX).toBe(18);
    for (const value of ["{", JSON.stringify({ ...adventure, leftX: 101 })]) {
      const failed = reduceAdventureEditor(initial, { type: "draft-read", available: true, value }).state;
      expect(failed.current).toEqual(adventure);
      expect(projectAdventureEditor(failed).message).toContain("読み取れなかった");
    }
    expect(
      projectAdventureEditor(
        reduceAdventureEditor(initial, { type: "draft-read", available: false, value: null }).state,
      ).message,
    ).toContain("読み取れなかった");
    let state = reduceAdventureEditor(initial, { type: "draft-read", available: true, value: null }).state;
    state = reduceAdventureEditor(state, { type: "field", key: "leftX", raw: "22" }).state;
    state = reduceAdventureEditor(state, { type: "storage-result", available: false }).state;
    expect(projectAdventureEditor(state).message).toContain("一時保存はできません");
    state = reduceAdventureEditor(state, { type: "field", key: "leftX", raw: "24" }).state;
    expect(projectAdventureEditor(state).message).toContain("一時保存はできません");
    state = reduceAdventureEditor(state, { type: "storage-result", available: true }).state;
    expect(projectAdventureEditor(state).message).toBe("未保存の調整です。このブラウザに一時保存しています。");
    state = reduceAdventureEditor(state, { type: "preview" }).state;
    expect(state).toMatchObject({ preview: true, focus: { kind: "preview-back" } });
    expect(reduceAdventureEditor(state, { type: "key", key: "Tab", shift: true }).handled).toBe(false);
    state = reduceAdventureEditor(state, { type: "preview-back" }).state;
    state = reduceAdventureEditor(state, { type: "key", key: "Tab", shift: false }).state;
    expect(state.focus).toEqual({ kind: "save" });
    state = reduceAdventureEditor(state, {
      type: "focused",
      target: { kind: "field", key: "leftX", control: "number" },
    }).state;
    expect(reduceAdventureEditor(state, { type: "key", key: "Tab", shift: true }).state.focus).toEqual({
      kind: "revert",
    });
    state = reduceAdventureEditor(state, { type: "blurred", target: { kind: "save" } }).state;
    expect(state.focus).toEqual({ kind: "field", key: "leftX", control: "number" });
    state = reduceAdventureEditor(state, {
      type: "blurred",
      target: { kind: "field", key: "leftX", control: "number" },
    }).state;
    expect(state.focus).toBeNull();
    expect(reduceAdventureEditor(state, { type: "key", key: "Tab", shift: false }).handled).toBe(false);
    state = reduceAdventureEditor(state, { type: "closed" }).state;
    expect(reduceAdventureEditor(state, { type: "save-success", message: "遅い応答" }).handled).toBe(false);
  });

  it("会話編集は本物のGuild初回状態を直接描き、街時計/XPを作らない", () => {
    const game = createInitialGameState(initialGameOptions),
      before = structuredClone(game);
    const state = createAdventureEditorPreview(game, initialAdventure);
    const frame = projectAdventure({
      state: state.game,
      definition: initialAdventure,
      calendar: "OUTPOST / TOWN",
      feedback: [],
      prompt: "行き先を選ぶ",
      focus: state.focus,
      editorPreview: true,
    });
    expect(frame.scene).toMatchObject({ type: "line", text: "ロッシは掲示板の前で足を止めた。" });
    expect(state.game.currentPlaceId).toBe("guild");
    expect(game).toEqual(before);
  });
});
