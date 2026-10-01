import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { advanceConversation, chooseConversationOption, selectTownPlace } from "./adventure";
import { createInitialGameState } from "./createInitialGameState";
import {
  actInExpedition,
  departOnExpedition,
  type ExpeditionGame,
  type ExpeditionResult,
  editExpeditionParty,
  leaveExpedition,
} from "./expedition";
import { type CharacterDefinition, createParty } from "./party";

const companions: readonly CharacterDefinition[] = [
  ...characters,
  { id: "scout", name: "斥候（仮）", maxHp: 24, speed: 95, attackPower: 7 },
  { id: "guard", name: "衛兵（仮）", maxHp: 28, speed: 80, attackPower: 9 },
  { id: "reserve", name: "控え（仮）", maxHp: 16, speed: 100, attackPower: 5 },
];
function newGame(joined = ["player"]): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(companions, joined),
    dungeon: null,
  };
}
function accepted(result: ExpeditionResult): ExpeditionGame {
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
function depart(state: ExpeditionGame): ExpeditionGame {
  return accepted(departOnExpedition(state, companions, initialDungeon, initialAdventure));
}
function act(state: ExpeditionGame, command: Parameters<typeof actInExpedition>[1]): ExpeditionGame {
  const update = actInExpedition(state, command, initialDungeon, initialAdventure);
  if (!update.result.accepted) throw new Error(update.result.reason);
  return update.state;
}

describe("仲間と出撃編成", () => {
  it("ロッシだけの新規ゲームから3枠空けて出撃する", () => {
    const state = newGame();
    expect(state.party.members).toEqual([{ id: "player", hp: 20 }]);
    expect(state.party.slots).toEqual(["player", null, null, null]);
    const entered = act(depart(state), { type: "enter", nodeId: "battle-a" });
    expect(entered.dungeon?.party).toMatchObject([{ id: "player", hp: 20 }]);
    expect(entered.dungeon?.activity).toMatchObject({ type: "battle", state: { currentActorId: "player" } });
  });

  it.each([1, 2, 3, 4])("%i人を出撃させ、5人目までの控えを保持する", (count) => {
    let state = newGame(companions.map(({ id }) => id));
    for (let slot = 1; slot < count; slot++) state = accepted(editExpeditionParty(state, slot, companions[slot].id));
    state = act(depart(state), { type: "enter", nodeId: "conversation-b" });
    state = act(state, { type: "advance" });
    state = act(state, { type: "choose", optionId: "continue-without-marking" });
    state = act(state, { type: "enter", nodeId: "boss-c" });
    expect(state.dungeon?.party.map(({ id }) => id)).toEqual(companions.slice(0, count).map(({ id }) => id));
    expect(state.party.members).toHaveLength(5);
    expect(state.party.members.find(({ id }) => id === "reserve")).toEqual({ id: "reserve", hp: 16 });
    expect(editExpeditionParty(state, 0, "reserve")).toMatchObject({ accepted: false, reason: "not-in-town" });
    for (let turn = 0; state.dungeon?.activity?.type === "battle" && turn < 10; turn++) {
      const actorId = state.dungeon.activity.state.currentActorId;
      if (!actorId) throw new Error("入力待ちの味方がいません");
      state = act(state, { type: "attack", actorId, targetId: "ruin-warden" });
    }
    expect(state.dungeon?.outcome).toBe("cleared");
    state = accepted(leaveExpedition(state));
    expect(state.party.slots.filter((id) => id !== null)).toEqual(companions.slice(0, count).map(({ id }) => id));
  });

  it("未加入・未知ID・重複・不正枠を拒否し、空編成では出撃しない", () => {
    const state = newGame();
    for (const id of ["gilberta", "missing"])
      expect(editExpeditionParty(state, 1, id)).toMatchObject({ accepted: false, reason: "not-joined" });
    expect(editExpeditionParty(state, 1, "player")).toMatchObject({ accepted: false, reason: "duplicate-member" });
    for (const slot of [-1, 4, 0.5, Number.NaN])
      expect(editExpeditionParty(state, slot, null)).toMatchObject({ accepted: false, reason: "invalid-slot" });
    const empty = accepted(editExpeditionParty(state, 0, null));
    expect(departOnExpedition(empty, companions, initialDungeon, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "empty-party",
    });
    expect(empty.party.members).toEqual([{ id: "player", hp: 20 }]);
  });

  it("会話中・探索中は編成と再出撃を拒否する", () => {
    const initial = newGame();
    const conversation = selectTownPlace(initial.adventure, "town-square", initialAdventure);
    if (!conversation.accepted) throw new Error(conversation.reason);
    for (const state of [{ ...initial, adventure: conversation.state }, depart(initial)]) {
      expect(editExpeditionParty(state, 0, null)).toMatchObject({ accepted: false, reason: "not-in-town" });
      expect(departOnExpedition(state, companions, initialDungeon, initialAdventure)).toMatchObject({
        accepted: false,
        reason: "not-in-town",
      });
    }
  });

  it("傷ついた出撃者を控えと交換してもHPを変えず、次の探索へ引き継ぐ", () => {
    let state = depart(newGame(["player", "gilberta"]));
    state = act(state, { type: "enter", nodeId: "battle-a" });
    state = act(state, { type: "attack", actorId: "player", targetId: "slime-2" });
    expect(state.party.members).toEqual([
      { id: "player", hp: 13 },
      { id: "gilberta", hp: 18 },
    ]);
    expect(leaveExpedition(state)).toMatchObject({ accepted: false, reason: "not-on-route" });
    for (const targetId of ["slime-2", "slime", "slime"])
      state = act(state, { type: "attack", actorId: "player", targetId });
    expect(state.party.members).toEqual([
      { id: "player", hp: 5 },
      { id: "gilberta", hp: 18 },
    ]);
    state = accepted(leaveExpedition(state));
    state = accepted(editExpeditionParty(state, 0, "gilberta"));
    expect(state.party.slots).toEqual(["gilberta", null, null, null]);
    expect(state.party.members).toEqual([
      { id: "player", hp: 5 },
      { id: "gilberta", hp: 18 },
    ]);
    state = accepted(editExpeditionParty(state, 2, "player"));
    state = depart(state);
    expect(state.dungeon?.party).toMatchObject([
      { id: "gilberta", hp: 18 },
      { id: "player", hp: 5 },
    ]);
  });

  it("街と探索の会話フラグを出撃・退出を通して保持する", () => {
    let state = newGame();
    const start = selectTownPlace(state.adventure, "guild", initialAdventure);
    if (!start.accepted) throw new Error(start.reason);
    let conversation = advanceConversation(start.state, initialAdventure);
    if (!conversation.accepted) throw new Error(conversation.reason);
    conversation = advanceConversation(conversation.state, initialAdventure);
    if (!conversation.accepted) throw new Error(conversation.reason);
    const end = chooseConversationOption(conversation.state, "leave", initialAdventure);
    if (!end.accepted) throw new Error(end.reason);
    state = depart({ ...state, adventure: end.state });
    expect(state.dungeon?.flags).toEqual(["visited-guild"]);
    state = act(state, { type: "enter", nodeId: "conversation-b" });
    state = act(state, { type: "advance" });
    state = act(state, { type: "choose", optionId: "mark-on-map" });
    const invalid = actInExpedition(
      state,
      { type: "enter", nodeId: "conversation-b" },
      initialDungeon,
      initialAdventure,
    );
    expect(invalid.result).toMatchObject({ accepted: false, reason: "node-already-resolved" });
    state = accepted(leaveExpedition(invalid.state));
    expect(state.adventure.flags).toEqual(["visited-guild", "marked-ruins-route", "scouted-ruins"]);
  });

  it("単独で会話分岐からボスを倒し、結果のHPを街まで保持する", () => {
    let state = act(depart(newGame()), { type: "enter", nodeId: "conversation-b" });
    state = act(state, { type: "advance" });
    state = act(state, { type: "choose", optionId: "mark-on-map" });
    state = act(state, { type: "enter", nodeId: "boss-c" });
    for (let i = 0; i < 4; i++) state = act(state, { type: "attack", actorId: "player", targetId: "ruin-warden" });
    expect(state.dungeon?.outcome).toBe("cleared");
    state = accepted(leaveExpedition(state));
    expect(state.dungeon).toBeNull();
    expect(state.party.members).toEqual([{ id: "player", hp: 5 }]);
    expect(state.adventure.flags).toEqual(["marked-ruins-route", "scouted-ruins"]);
    expect(leaveExpedition(state)).toMatchObject({ accepted: false, reason: "not-on-route" });
  });

  it("全滅後もHP0を保持し、生存者なしの再出撃を拒否する", () => {
    let state = act(depart(newGame()), { type: "enter", nodeId: "battle-a" });
    for (const targetId of ["slime-2", "slime-2", "slime", "slime"])
      state = act(state, { type: "attack", actorId: "player", targetId });
    state = act(state, { type: "enter", nodeId: "boss-c" });
    state = act(state, { type: "attack", actorId: "player", targetId: "ruin-warden" });
    expect(state.dungeon?.outcome).toBe("failed");
    state = accepted(leaveExpedition(state));
    state = accepted(editExpeditionParty(state, 0, null));
    state = accepted(editExpeditionParty(state, 3, "player"));
    expect(state.party.members).toEqual([{ id: "player", hp: 0 }]);
    expect(departOnExpedition(state, companions, initialDungeon, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "no-living-member",
    });
  });
});
