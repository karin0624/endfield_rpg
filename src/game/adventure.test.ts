import { describe, expect, it } from "vitest";

import { initialAdventure } from "../content/initialAdventure";
import { initialGameOptions } from "../content/initialGameOptions";
import {
  type AdventureDefinition,
  advanceConversation,
  assertValidAdventureDefinition,
  chooseConversationOption,
  getAvailableTownPlaces,
  getCurrentConversationScene,
  selectTownPlace,
} from "./adventure";
import { createInitialGameState } from "./createInitialGameState";

describe("街・会話の進行", () => {
  it("場所選択から会話、選択肢、フラグ更新、再訪分岐まで進む", () => {
    let state = createInitialGameState(initialGameOptions);

    expect(getAvailableTownPlaces(state, initialAdventure)).toEqual([
      { id: "town-square", label: "街の広場" },
      { id: "guild", label: "冒険者ギルド" },
      { id: "market", label: "市場" },
    ]);

    const started = selectTownPlace(state, "guild", initialAdventure);
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;
    state = started.state;
    expect(state).toMatchObject({
      mode: "conversation",
      currentPlaceId: "guild",
    });

    expect(getCurrentConversationScene(state, initialAdventure)).toMatchObject({
      type: "line",
      text: "ロッシは掲示板の前で足を止めた。",
      presentation: { speakerName: "ロッシ", portraitId: "rossi", position: "left" },
    });
    const greeted = advanceConversation(state, initialAdventure);
    expect(greeted.accepted).toBe(true);
    if (!greeted.accepted) return;
    state = greeted.state;

    const greeting = getCurrentConversationScene(state, initialAdventure);
    expect(greeting).toMatchObject({
      type: "line",
      text: "ギルベルタが掲示板の前で会釈した。",
      presentation: {
        speakerName: "ギルベルタ",
        backgroundId: "guild-hall",
        portraitId: "gilberta",
        expressionId: "smile",
        position: "center",
      },
    });
    expect(getCurrentConversationScene(state, initialAdventure)).toEqual(greeting);
    expect(state.flags).toEqual([]);

    const choiceStep = advanceConversation(state, initialAdventure);
    expect(choiceStep.accepted).toBe(true);
    if (!choiceStep.accepted) return;
    state = choiceStep.state;
    const choiceScene = getCurrentConversationScene(state, initialAdventure);
    expect(choiceScene).toMatchObject({
      type: "choice",
      prompt: "何を聞こう？",
      options: [
        { id: "ask-quest", label: "掲示板の依頼について聞く" },
        { id: "leave", label: "今日は何も聞かない" },
      ],
    });

    const lockedChoice = chooseConversationOption(state, "ask-secret", initialAdventure);
    expect(lockedChoice).toEqual({ accepted: false, reason: "choice-unavailable", state });
    expect(state.flags).toEqual([]);

    const selected = chooseConversationOption(state, "ask-quest", initialAdventure);
    expect(selected.accepted).toBe(true);
    if (!selected.accepted) return;
    state = selected.state;
    expect(state.flags).toEqual(["heard-guild-quest"]);
    expect(getCurrentConversationScene(state, initialAdventure)).toMatchObject({
      type: "line",
      text: "街道の様子を調べる依頼が出ているそうだ。",
    });

    const completed = advanceConversation(state, initialAdventure);
    expect(completed.accepted).toBe(true);
    if (!completed.accepted) return;
    state = completed.state;
    expect(state).toMatchObject({
      mode: "town",
      currentPlaceId: "guild",
      flags: ["heard-guild-quest", "visited-guild"],
    });
    expect(getCurrentConversationScene(state, initialAdventure)).toBeNull();

    const duplicateAdvance = advanceConversation(state, initialAdventure);
    expect(duplicateAdvance).toEqual({ accepted: false, reason: "not-in-conversation", state });

    const revisited = selectTownPlace(state, "guild", initialAdventure);
    expect(revisited.accepted).toBe(true);
    if (!revisited.accepted) return;
    expect(getCurrentConversationScene(revisited.state, initialAdventure)).toMatchObject({
      type: "line",
      text: "ギルベルタは前回の話を覚えていた。「街道調査の依頼、詳しい内容をまとめておきました」",
    });
  });

  it("依頼の話を選ばずに会話を終えた後は別の再訪会話になる", () => {
    const initialState = createInitialGameState(initialGameOptions);
    const started = selectTownPlace(initialState, "guild", initialAdventure);
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;

    const greeting = advanceConversation(started.state, initialAdventure);
    expect(greeting.accepted).toBe(true);
    if (!greeting.accepted) return;
    const atChoice = advanceConversation(greeting.state, initialAdventure);
    expect(atChoice.accepted).toBe(true);
    if (!atChoice.accepted) return;

    const left = chooseConversationOption(atChoice.state, "leave", initialAdventure);
    expect(left.accepted).toBe(true);
    if (!left.accepted) return;
    expect(left.state.flags).toEqual(["visited-guild"]);

    const revisited = selectTownPlace(left.state, "guild", initialAdventure);
    expect(revisited.accepted).toBe(true);
    if (!revisited.accepted) return;
    expect(getCurrentConversationScene(revisited.state, initialAdventure)).toMatchObject({
      type: "line",
      text: "ギルベルタは顔を覚えていた。「前回は依頼の話をしませんでしたね。今日は何か聞きますか？」",
    });
  });

  it("会話中の移動と街に存在しない場所を拒否し、状態を変えない", () => {
    const townState = createInitialGameState(initialGameOptions);
    const missingPlace = selectTownPlace(townState, "unknown", initialAdventure);
    expect(missingPlace).toEqual({ accepted: false, reason: "place-unavailable", state: townState });

    const started = selectTownPlace(townState, "market", initialAdventure);
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;
    const rejectedMove = selectTownPlace(started.state, "guild", initialAdventure);
    expect(rejectedMove).toEqual({ accepted: false, reason: "not-in-town", state: started.state });
    expect(getAvailableTownPlaces(started.state, initialAdventure)).toEqual([]);
  });

  it("会話データの場所参照と選択肢の到達先を検証する", () => {
    expect(() => assertValidAdventureDefinition(initialAdventure)).not.toThrow();

    const missingConversation: AdventureDefinition = {
      ...initialAdventure,
      places: initialAdventure.places.map((place) =>
        place.id === "market" ? { ...place, routes: [{ conversationId: "missing" }] } : place,
      ),
    };
    expect(() => assertValidAdventureDefinition(missingConversation)).toThrow("場所が参照する会話が存在しません");

    const firstVisit = initialAdventure.conversations.find((conversation) => conversation.id === "guild-first");
    const choiceNode = firstVisit?.nodes["ask-about-work"];
    if (choiceNode?.type !== "choice") {
      throw new Error("初回ギルド会話に選択肢ノードがありません");
    }
    const missingChoiceTarget: AdventureDefinition = {
      ...initialAdventure,
      conversations: initialAdventure.conversations.map((conversation) =>
        conversation.id === "guild-first"
          ? {
              ...conversation,
              nodes: {
                ...conversation.nodes,
                "ask-about-work": {
                  ...choiceNode,
                  options: choiceNode.options.map((option) =>
                    option.id === "ask-quest" ? { ...option, nextNodeId: "missing" } : option,
                  ),
                },
              },
            }
          : conversation,
      ),
    };
    expect(() => assertValidAdventureDefinition(missingChoiceTarget)).toThrow("選択肢の進行先が存在しません");
  });
});
