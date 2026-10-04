import { expect, it } from "vitest";
import { saveDefinitions } from "../src/content/saveDefinitions";
import { deserializeGame } from "../src/game/save";
import {
  type CampaignCommand,
  type CampaignEvent,
  createCampaignModel,
  reduceCampaign,
} from "../src/presentation/campaignModel";
import { projectCampaign } from "../src/presentation/campaignProjection";
import { returnedCampaign as returnedPicture } from "./fixtures/returned-campaign";

it("実コアで街・分岐成長・ボス戦・帰還・保存再開を確定し、帰還画像に渡す状態を保証する", () => {
  const initial = createCampaignModel();
  const initialGame = structuredClone(initial.game);
  let state = initial;
  const send = (event: CampaignEvent) => {
    const transition = reduceCampaign(state, event);
    expect(transition.handled).toBe(true);
    state = transition.state;
    return transition;
  };
  const command = (command: CampaignCommand) => send({ type: "command", command });
  for (const next of ["new-game", "accept", "home", "destinations", "town"] as const) command(next);
  send({ type: "town", event: { type: "select", placeId: "market" } });
  expect(state.game.clock?.elapsedHalfDays).toBe(0);
  send({ type: "town", event: { type: "advance" } });
  expect(state.game.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
  for (const next of ["home", "destinations", "prepare-departure"] as const) command(next);
  send({ type: "party", event: { type: "depart" } });
  send({ type: "dungeon", command: { type: "enter", nodeId: "conversation-b" } });
  send({ type: "dungeon", command: { type: "advance" } });
  send({ type: "dungeon", command: { type: "choose", optionId: "mark-on-map" } });
  expect(state.game.growth?.choice).toMatchObject({
    level: 2,
    candidateIds: ["test-power", "test-vitality", "test-light-strike"],
  });
  expect(state.game.party.members.find(({ id }) => id === "player")?.hp).toBe(28);
  send({ type: "growth", event: { type: "choose", skillId: "test-power" } });
  expect(state.game.growth?.choice).toMatchObject({
    level: 3,
    candidateIds: ["test-light-strike", "test-strength", "test-vitality"],
  });
  send({ type: "growth", event: { type: "choose", skillId: "test-light-strike" } });
  expect(state.game.growth?.choice).toBeNull();
  send({ type: "dungeon", command: { type: "enter", nodeId: "boss-c" } });
  for (const [expectedActionTime, hp, mentalFatigue, outcome] of [
    [100, 23, 4, "ongoing"],
    [200, 23, 8, "cleared"],
  ] as const) {
    const result = send({
      type: "dungeon",
      command: {
        type: "skill",
        actorId: "player",
        targetId: "ruin-warden",
        skillId: "test-strike",
        expectedActionTime,
        expectedNodeId: "boss-c",
        expeditionActionId: 2,
      },
    });
    expect(result.dungeonResult?.accepted).toBe(true);
    expect(state.game.party.members.find(({ id }) => id === "player")).toMatchObject({ hp, mentalFatigue });
    expect(state.game.dungeon?.outcome).toBe(outcome);
    expect(state.game.clock?.elapsedHalfDays).toBe(1);
  }
  send({ type: "return-home" });
  const beforeSave = state;
  const home = structuredClone(state.game);
  expect(state.game).toMatchObject({
    party: { slots: ["player", null, null, null], members: [{ id: "player", hp: 20, mentalFatigue: 8 }] },
    clock: { elapsedHalfDays: 2, recoverySteps: 1, pendingAction: null },
    dungeon: null,
    randomState: 2388811721,
  });
  expect(state.completion).toMatchObject({ outcome: "cleared", returnedIds: ["player"], calendarHalfDays: 1 });
  // The visual fixture supplies this already-confirmed public state; it never plays these inputs in a browser.
  expect(state.game.party).toEqual(returnedPicture.game.party);
  expect(state.game.clock).toEqual(returnedPicture.game.clock);
  expect(state.game.inventory).toEqual(returnedPicture.game.inventory);
  expect(state.completion).toEqual(returnedPicture.completion);
  expect(projectCampaign(state)).toMatchObject({
    kind: "home",
    calendar: "2日目 · 昼",
    feedback: ["出撃者のHPが全回復しました。", "ロッシ · 精神疲労 8（なし）"],
  });
  command("save-title");
  const saved = command("accept").effects[0];
  if (saved?.type !== "write-save") throw new Error("save");
  expect(deserializeGame(saved.data, saveDefinitions)).toMatchObject({
    accepted: true,
    state: {
      party: home.party,
      clock: home.clock,
      inventory: home.inventory,
      randomState: 2388811721,
      growth: { closed: true, choice: null, randomState: 2388811721 },
    },
  });
  send({ type: "save-written", saved: true });
  expect(projectCampaign(state)).toMatchObject({ kind: "title", status: "保存しました。" });
  command("load");
  send({ type: "save-read", result: { data: saved.data } });
  expect(state.game.party).toEqual(home.party);
  expect(state.game.randomState).toBe(2388811721);
  expect(projectCampaign(state)).toMatchObject({ kind: "home", calendar: "2日目 · 昼", status: "読み込みました。" });
  const nextMarket = (source: typeof state) => {
    let next = source;
    for (const event of [
      { type: "command", command: "destinations" },
      { type: "command", command: "town" },
      { type: "town", event: { type: "select", placeId: "market" } },
      { type: "town", event: { type: "advance" } },
    ] as const) {
      const transition = reduceCampaign(next, event);
      expect(transition.handled).toBe(true);
      next = transition.state;
    }
    expect(next.game.clock).toMatchObject({ elapsedHalfDays: 3, recoverySteps: 2, pendingAction: null });
    expect(next.game.party.members.find(({ id }) => id === "player")).toMatchObject({ hp: 20, mentalFatigue: 0 });
    expect(next.game.randomState).toBe(2388811721);
    return next.game;
  };
  const resumed = nextMarket(state);
  const uninterrupted = nextMarket(beforeSave);
  expect(resumed.party).toEqual(uninterrupted.party);
  expect(resumed.adventure).toEqual(uninterrupted.adventure);
  expect(resumed.clock).toEqual(uninterrupted.clock);
  expect(beforeSave.game).toEqual(home);
  expect(initial.game).toEqual(initialGame);
});
