import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import type { AdventureDefinition } from "./adventure";
import { createInitialGameState } from "./createInitialGameState";
import {
  actInTown,
  applyPartyStatus,
  beginTownExploration,
  departOnExpedition,
  type ExpeditionGame,
  type TownActionResult,
} from "./expedition";
import { createParty, recruitPartyMember, setPartySlot } from "./party";
import { healthyStatus } from "./status";

function game(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
    randomState: 1,
  };
}
function accepted(result: TownActionResult): ExpeditionGame {
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
function invite(state: ExpeditionGame): TownActionResult {
  const started = accepted(beginTownExploration(state, "find-companion", initialAdventure));
  const id = started.clock?.pendingAction?.id ?? -1;
  const choice = accepted(actInTown(started, id, { type: "advance" }, characters, initialAdventure));
  return actInTown(choice, id, { type: "choose", optionId: "invite-gilberta" }, characters, initialAdventure);
}
describe("街探索による仲間加入", () => {
  it("初期はロッシ単独。会話終了だけで加入し、初期HPとフラグを持つ控えになる", () => {
    const initial = game();
    expect(initial.party.members.map(({ id }) => id)).toEqual(["player"]);
    expect(departOnExpedition(initial, characters, initialDungeon, initialAdventure).accepted).toBe(true);
    let state = accepted(beginTownExploration(initial, "find-companion", initialAdventure));
    const actionId = state.clock?.pendingAction?.id ?? -1;
    expect(state.party.members).toHaveLength(1);
    state = accepted(actInTown(state, actionId, { type: "advance" }, characters, initialAdventure));
    expect(state.party.members).toHaveLength(1);
    expect(state.clock?.elapsedHalfDays).toBe(0);
    const joined = actInTown(
      state,
      actionId,
      { type: "choose", optionId: "invite-gilberta" },
      characters,
      initialAdventure,
    );
    state = accepted(joined);
    expect(state.party.members.map(({ id, hp }) => ({ id, hp }))).toEqual([
      { id: "player", hp: 20 },
      { id: "gilberta", hp: 18 },
    ]);
    expect(state.party.slots).toEqual(["player", null, null, null]);
    expect(state.adventure.flags).toContain("joined-gilberta");
    expect(joined).toMatchObject({ completion: { recruitedIds: ["gilberta"], calendarHalfDays: 1, recoverySteps: 1 } });
    expect(
      actInTown(state, actionId, { type: "choose", optionId: "invite-gilberta" }, characters, initialAdventure),
    ).toMatchObject({ accepted: false, reason: "action-not-current" });
    expect(state.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    expect(setPartySlot(state.party, 1, "gilberta").accepted).toBe(true);
  });
  it("見送りは加入も加入フラグも残さず、再訪で改めて選べる", () => {
    let state = accepted(beginTownExploration(game(), "find-companion", initialAdventure));
    const id = state.clock?.pendingAction?.id ?? -1;
    state = accepted(actInTown(state, id, { type: "advance" }, characters, initialAdventure));
    const declined = actInTown(state, id, { type: "choose", optionId: "leave" }, characters, initialAdventure);
    state = accepted(declined);
    expect(state.party.members.map(({ id }) => id)).toEqual(["player"]);
    expect(state.adventure.flags).not.toContain("joined-gilberta");
    expect(declined).toMatchObject({ completion: { recruitedIds: [] } });
    expect(invite(state)).toMatchObject({ accepted: true, completion: { recruitedIds: ["gilberta"] } });
  });
  it("重複加入効果はHP・症状・残り回復を初期化せず、再訪も通常の回復1stepだけ", () => {
    let state = accepted(invite(game()));
    state = applyPartyStatus(state, "gilberta", "haze", characters);
    state = applyPartyStatus(state, "gilberta", "haze", characters);
    state = applyPartyStatus(state, "gilberta", "incapacity", characters);
    const damaged = {
      ...state.party,
      members: state.party.members.map((member) => (member.id === "gilberta" ? { ...member, hp: 3 } : member)),
    };
    const duplicate = recruitPartyMember(
      damaged,
      { characterId: "gilberta", when: { none: ["joined-gilberta"] } },
      characters,
      state.adventure.flags,
    );
    expect(duplicate).toMatchObject({
      accepted: true,
      added: false,
      state: {
        members: [{ id: "player" }, { id: "gilberta", hp: 3, status: { haze: 2, incapacityRecoverySteps: 6 } }],
      },
    });
    if (!duplicate.accepted) throw new Error(duplicate.reason);
    state = { ...state, party: duplicate.state };
    state = accepted(beginTownExploration(state, "find-companion", initialAdventure));
    const revisited = actInTown(
      state,
      state.clock?.pendingAction?.id ?? -1,
      { type: "advance" },
      characters,
      initialAdventure,
    );
    expect(revisited).toMatchObject({
      accepted: true,
      completion: { recruitedIds: [] },
      state: {
        party: {
          members: [{ id: "player" }, { id: "gilberta", hp: 3, status: { haze: 1, incapacityRecoverySteps: 5 } }],
        },
      },
    });
  });
  it("満員4枠を押し出さず、5人目を控えへ追加する", () => {
    const definitions = [
      ...characters,
      ...["a", "b", "c"].map((id) => ({ id, name: id, maxHp: 10, speed: 100, attackPower: 1 })),
    ];
    let party = createParty(definitions, ["player", "a", "b", "c"]);
    for (const [index, id] of ["a", "b", "c"].entries()) {
      const set = setPartySlot(party, index + 1, id);
      if (!set.accepted) throw new Error(set.reason);
      party = set.state;
    }
    const recruited = recruitPartyMember(party, { characterId: "gilberta" }, definitions, []);
    expect(recruited).toMatchObject({ accepted: true, added: true, state: { slots: ["player", "a", "b", "c"] } });
    if (!recruited.accepted) throw new Error(recruited.reason);
    expect(recruited.state.members.map(({ id }) => id)).toEqual(["player", "a", "b", "c", "gilberta"]);
  });
  it("不明ID・条件未達を拒否し、失敗したイベント完了は時間・フラグ・仲間を変更しない", () => {
    expect(recruitPartyMember(game().party, { characterId: "unknown" }, characters, [])).toMatchObject({
      accepted: false,
      reason: "unknown-character",
    });
    expect(
      recruitPartyMember(game().party, { characterId: "gilberta", when: { all: ["eligible"] } }, characters, []),
    ).toMatchObject({ accepted: false, reason: "recruitment-unavailable" });
    const definition: AdventureDefinition = {
      places: [{ id: "test", label: "仮", routes: [{ conversationId: "test" }] }],
      conversations: [
        {
          id: "test",
          startNodeId: "line",
          onCompleteFlags: ["finished"],
          nodes: {
            line: { type: "line", text: "仮", nextNodeId: "end" },
            end: { type: "end", recruitments: [{ characterId: "gilberta", when: { all: ["eligible"] } }] },
          },
        },
      ],
    };
    const state = accepted(beginTownExploration(game(), "test", definition));
    const result = actInTown(state, state.clock?.pendingAction?.id ?? -1, { type: "advance" }, characters, definition);
    expect(result).toMatchObject({
      accepted: false,
      reason: "recruitment-unavailable",
      state: {
        adventure: { mode: "conversation", flags: [] },
        clock: { elapsedHalfDays: 0, recoverySteps: 0 },
        party: { members: [{ id: "player" }] },
      },
    });
  });
  it("加入済みの無条件no-opから、条件未達の加入フラグを付与しない", () => {
    const definition: AdventureDefinition = {
      places: [{ id: "test", label: "仮", routes: [{ conversationId: "test" }] }],
      conversations: [
        {
          id: "test",
          startNodeId: "line",
          nodes: {
            line: { type: "line", text: "仮", nextNodeId: "end" },
            end: {
              type: "end",
              recruitments: [
                { characterId: "gilberta", when: { all: ["eligible"] }, setFlags: ["enrollment-verified"] },
              ],
            },
          },
        },
      ],
    };
    const state = accepted(beginTownExploration(accepted(invite(game())), "test", definition));
    const completed = actInTown(
      state,
      state.clock?.pendingAction?.id ?? -1,
      { type: "advance" },
      characters,
      definition,
    );
    const next = accepted(completed);
    expect(next.adventure.flags).not.toContain("enrollment-verified");
    expect(next.party.members.filter(({ id }) => id === "gilberta")).toHaveLength(1);
    expect(completed).toMatchObject({ completion: { recruitedIds: [] } });
  });
  it("複数加入も会話終了の半日を1回だけ計上する", () => {
    const definitions = [...characters, { id: "scout", name: "斥候（仮）", maxHp: 10, speed: 100, attackPower: 1 }];
    const definition: AdventureDefinition = {
      places: [{ id: "test", label: "仮", routes: [{ conversationId: "test" }] }],
      conversations: [
        {
          id: "test",
          startNodeId: "line",
          nodes: {
            line: { type: "line", text: "仮", nextNodeId: "end" },
            end: { type: "end", recruitments: [{ characterId: "gilberta" }, { characterId: "scout" }] },
          },
        },
      ],
    };
    const state = accepted(beginTownExploration(game(), "test", definition));
    const completed = actInTown(
      state,
      state.clock?.pendingAction?.id ?? -1,
      { type: "advance" },
      definitions,
      definition,
    );
    expect(completed).toMatchObject({
      accepted: true,
      completion: { recruitedIds: ["gilberta", "scout"], calendarHalfDays: 1, recoverySteps: 1 },
      state: { clock: { elapsedHalfDays: 1, recoverySteps: 1 }, party: { slots: ["player", null, null, null] } },
    });
  });
  it("全員戦闘不能でも非戦闘の加入イベントを終えられる", () => {
    const initial = applyPartyStatus(game(), "player", "incapacity", characters);
    const joined = accepted(invite(initial));
    expect(joined.party.members.map(({ id }) => id)).toEqual(["player", "gilberta"]);
    expect(joined.party.members[0].status?.incapacityRecoverySteps).toBe(5);
    expect(joined.party.members[1].status ?? healthyStatus()).toEqual({
      physicalFatigue: 0,
      haze: 0,
      incapacityRecoverySteps: null,
    });
    expect(joined.party.slots).toEqual(["player", null, null, null]);
  });
});
