import { describe, expect, it } from "vitest";
import { initialAdventure } from "../content/initialAdventure";
import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "../game/createInitialGameState";
import { type AdventureEvent, type AdventureModel, createAdventureModel, reduceAdventure } from "./adventureModel";
import { projectAdventure } from "./adventureProjection";

const send = (state: AdventureModel, event: AdventureEvent) => reduceAdventure(state, event, initialAdventure).state;
const initial = () => createAdventureModel(createInitialGameState(initialGameOptions));
const frame = (state: AdventureModel, editorPreview = false) =>
  projectAdventure({
    state: state.game,
    definition: initialAdventure,
    calendar: "OUTPOST / TOWN",
    feedback: [],
    prompt: "行き先を選ぶ",
    focus: state.focus,
    editorPreview,
  });
function guildChoice() {
  let state = send(initial(), { type: "select", placeId: "guild" });
  state = send(state, { type: "advance" });
  return send(state, { type: "advance" });
}

describe("街・会話の現在状態と意味入力", () => {
  it("連続する文章送りは次の文章で受理し、選択肢では文章送りを拒否する", () => {
    const source = initial();
    const before = structuredClone(source.game);
    let state = send(source, { type: "select", placeId: "guild" });
    expect(frame(state).scene).toMatchObject({
      type: "line",
      speaker: "ロッシ",
      text: "ロッシは掲示板の前で足を止めた。",
    });
    state = send(state, { type: "key", code: "Space" });
    expect(frame(state).scene).toMatchObject({
      type: "line",
      speaker: "ギルベルタ",
      text: "ギルベルタが掲示板の前で会釈した。",
    });
    state = send(state, { type: "key", code: "Space" });
    expect(frame(state).scene).toMatchObject({ type: "choice", text: "何を聞こう？" });
    const choice = structuredClone(state.game);
    expect(reduceAdventure(state, { type: "advance" }, initialAdventure)).toMatchObject({
      handled: false,
      state: { game: choice },
    });
    expect(reduceAdventure(state, { type: "key", code: "Space" }, initialAdventure)).toMatchObject({
      handled: false,
      state: { game: choice },
    });
    expect(source.game).toEqual(before);
  });

  it("数字は公開されている候補の順へ対応し、隠れた候補と範囲外入力は受け付けない", () => {
    const state = guildChoice();
    const before = structuredClone(state.game);
    expect(frame(state).scene?.choices).toEqual([
      { id: "ask-quest", label: "掲示板の依頼について聞く", number: 1 },
      { id: "leave", label: "今日は何も聞かない", number: 2 },
    ]);
    expect(reduceAdventure(state, { type: "choose", optionId: "ask-secret" }, initialAdventure)).toMatchObject({
      handled: false,
      state: { game: before },
    });
    for (const code of ["Digit3", "Numpad9", "Digit0", "KeyA"])
      expect(reduceAdventure(state, { type: "key", code }, initialAdventure)).toMatchObject({
        handled: false,
        state: { game: before },
      });
    const ended = send(state, { type: "key", code: "Numpad2" });
    expect(ended.game).toMatchObject({ mode: "town", currentPlaceId: "guild", flags: ["visited-guild"] });
    expect(ended.focus).toEqual({ kind: "place", placeId: "guild" });
    const answered = send(state, { type: "key", code: "Digit1" });
    expect(frame(answered).scene?.text).toBe("街道の様子を調べる依頼が出ているそうだ。");
    expect(answered.game.flags).toContain("heard-guild-quest");
    expect(state.game).toEqual(before);
  });

  it("文字入力を奪わず、blurで画面へ戻れば同じキーを再び現在の文章へ適用する", () => {
    let state = send(initial(), { type: "select", placeId: "guild" });
    state = send(state, { type: "input-context", context: "text-entry" });
    const before = structuredClone(state.game);
    expect(reduceAdventure(state, { type: "key", code: "Space" }, initialAdventure)).toMatchObject({
      handled: false,
      state: { game: before },
    });
    state = send(state, { type: "input-context", context: "screen" });
    state = send(state, { type: "key", code: "Space" });
    expect(frame(state).scene?.text).toBe("ギルベルタが掲示板の前で会釈した。");
    const choice = send(guildChoice(), { type: "input-context", context: "text-entry" });
    expect(reduceAdventure(choice, { type: "key", code: "Digit1" }, initialAdventure).handled).toBe(false);
    expect(
      send(send(choice, { type: "input-context", context: "screen" }), { type: "key", code: "Digit1" }).game.flags,
    ).toContain("heard-guild-quest");
  });

  it("native buttonのSpaceはactivationへ任せ、意味clickと画面遷移で入力文脈を確定する", () => {
    let state = send(initial(), { type: "focused", target: { kind: "place", placeId: "market" } });
    state = send(state, { type: "input-context", context: "control" });
    expect(state.focus).toEqual({ kind: "place", placeId: "market" });
    state = send(state, { type: "select", placeId: "market" });
    expect(state.inputContext).toBe("screen");
    state = send(state, { type: "input-context", context: "control" });
    expect(reduceAdventure(state, { type: "key", code: "Space" }, initialAdventure).handled).toBe(false);
    state = send(state, { type: "advance" });
    expect(state).toMatchObject({
      game: { mode: "town" },
      inputContext: "screen",
      focus: { kind: "place", placeId: "market" },
    });
    state = send(state, { type: "select", placeId: "market" });
    expect(frame(state).scene?.type).toBe("line");
  });

  it("現在街で無効な操作と破棄後の入力は状態を変えず、閲覧・focusはゲームを変更しない", () => {
    const source = initial();
    const before = structuredClone(source.game);
    for (const event of [
      { type: "advance" },
      { type: "choose", optionId: "leave" },
      { type: "select", placeId: "missing" },
      { type: "home" },
      { type: "open-party" },
    ] as const)
      expect(reduceAdventure(source, event, initialAdventure)).toMatchObject({
        handled: false,
        state: { game: before },
      });
    const focused = send(source, { type: "focused", target: { kind: "place", placeId: "guild" } });
    expect(frame(focused)).toMatchObject({
      mode: "town",
      calendar: "OUTPOST / TOWN",
      status: "街の場所を選べます",
      focus: { kind: "place", placeId: "guild" },
    });
    expect(focused.game).toEqual(before);
    const disposed = send(focused, { type: "disposed" });
    for (const event of [
      { type: "select", placeId: "guild" },
      { type: "input-context", context: "control" },
      { type: "focused", target: { kind: "party-entry" } },
    ] as const)
      expect(reduceAdventure(disposed, event, initialAdventure)).toMatchObject({
        handled: false,
        state: { game: before },
      });
  });

  it("確定状態から話者・非話者・表情・配置とeditor previewを独立に投影する", () => {
    const source = send(initial(), { type: "select", placeId: "guild" });
    const before = structuredClone(source.game);
    expect(frame(source).scene?.portraits).toEqual([
      { id: "rossi", speaking: true, position: "left", path: "characters/rossi/expressions/neutral.png" },
      { id: "gilberta", speaking: false, position: "center", path: "characters/gilberta/expressions/smile.png" },
    ]);
    expect(frame(send(source, { type: "advance" }), true).scene?.portraits).toEqual([
      { id: "rossi", speaking: false, position: "left", path: "characters/rossi/expressions/neutral.png" },
      { id: "gilberta", speaking: true, position: "center", path: "characters/gilberta/expressions/smile.png" },
      { id: "rossi-preview", speaking: false, position: "right", path: "characters/rossi/expressions/neutral.png" },
    ]);
    expect(source.game).toEqual(before);
  });
});
