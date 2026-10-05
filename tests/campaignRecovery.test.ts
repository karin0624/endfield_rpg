import { expect, it } from "vitest";
import { characters } from "../src/content/characters";
import { saveDefinitions } from "../src/content/saveDefinitions";
import { applyPartyStatus } from "../src/game/expedition";
import { serializeGame } from "../src/game/save";
import {
  type CampaignEvent,
  createCampaignGame,
  createCampaignModel,
  reduceCampaign,
} from "../src/presentation/campaignModel";
import { projectCampaign } from "../src/presentation/campaignProjection";
import { createDebugSessionModel, reduceDebugSession } from "../src/presentation/debugSessionModel";
import { projectDebugSession } from "../src/presentation/debugSessionProjection";

it.each([
  ["campaign", 2365144877, 4],
  ["debug", 1018897798, 0],
] as const)("%sの実親モデルで敗北・保存再開・六回療養・再出撃を確定する", (entry, finalRandom, fatigue) => {
  let campaign = createCampaignModel(),
    debug = createDebugSessionModel("town");
  const depths = [
    { id: "slime", depth: 1 },
    { id: "slime-2", depth: 2 },
  ];
  const game = () => (entry === "campaign" ? campaign.game : debug.game);
  const send = (event: CampaignEvent) => {
    const result =
      entry === "campaign" ? reduceCampaign(campaign, event, depths) : reduceDebugSession(debug, event, depths);
    expect(result.handled).toBe(true);
    if (entry === "campaign") campaign = result.state as typeof campaign;
    else debug = result.state as typeof debug;
    return result;
  };
  const command = (command: Extract<CampaignEvent, { type: "command" }>["command"]) =>
    send({ type: "command", command });
  const load = (data: string) => {
    // Recreate the application owner as on entry/reload; only the public save crosses this boundary.
    if (entry === "campaign") {
      campaign = createCampaignModel();
      command("load");
    } else {
      debug = createDebugSessionModel("town");
      send({ type: "town", event: { type: "load" } });
    }
    send({ type: "save-read", result: { data } });
  };
  const saveAndLoad = () => {
    if (entry === "campaign") command("save-title");
    const issued = entry === "campaign" ? command("accept") : send({ type: "town", event: { type: "save" } });
    const effect = issued.effects.find((effect) => effect.type === "write-save");
    if (effect?.type !== "write-save") throw new Error("保存を開始すること");
    const before = structuredClone(game());
    send({ type: "save-written", saved: true });
    load(effect.data);
    expect(game().party).toEqual(before.party);
    expect(game().clock).toEqual(before.clock);
    expect(game().randomState).toBe(finalRandom);
  };
  const openDeparture = () => {
    if (entry === "campaign") {
      command("destinations");
      command("prepare-departure");
    } else send({ type: "town", event: { type: "open-party" } });
  };
  const partyFrame = () => {
    if (entry === "campaign") {
      const frame = projectCampaign(campaign);
      if (frame.kind !== "party") throw new Error("出発準備を表示すること");
      return frame.party;
    }
    const frame = projectDebugSession(debug);
    if (frame.kind !== "town" || !frame.town.adventure.party) throw new Error("街の出発準備を表示すること");
    return frame.town.adventure.party;
  };
  const backFromDeparture = () => {
    if (entry === "campaign") {
      send({ type: "party", event: { type: "back" } });
      command("home");
    } else send({ type: "town", event: { type: "party", event: { type: "back" } } });
  };
  const depart = () =>
    send(
      entry === "campaign"
        ? { type: "party", event: { type: "depart" } }
        : { type: "town", event: { type: "party", event: { type: "depart" } } },
    );

  // Initial data only: haze lowers accuracy to 2/3; actual seeded attacks, defeat and recovery follow.
  let initial = applyPartyStatus(
    { ...createCampaignGame(), randomState: 3 },
    "player",
    { kind: "haze", amount: 150 },
    characters,
  );
  initial = {
    ...initial,
    party: { ...initial.party, members: initial.party.members.map((member) => ({ ...member, hp: 1 })) },
  };
  const encoded = serializeGame(initial, saveDefinitions);
  if (!encoded.accepted) throw new Error(encoded.reason);
  const original = structuredClone(initial);
  load(encoded.data);
  openDeparture();
  expect(partyFrame().departure.disabled).toBe(false);
  depart();
  send({ type: "dungeon", event: { type: "enter", nodeId: "battle-a" } });
  const battle = entry === "campaign" ? campaign.expedition?.screen : debug.expedition?.screen;
  if (battle?.kind !== "battle") throw new Error("戦闘を開始すること");
  send({
    type: "dungeon",
    event: { type: "battle", event: { type: "scene-ready", owner: battle.battle.scene.owner } },
  });
  if (entry === "campaign") {
    send({ type: "dungeon", event: { type: "battle", event: { type: "open-skills" } } });
    send({ type: "dungeon", event: { type: "battle", event: { type: "select-skill", id: "test-strike" } } });
    send({ type: "dungeon", event: { type: "battle", event: { type: "use-skill" } } });
  } else send({ type: "dungeon", event: { type: "battle", event: { type: "attack" } } });
  expect(game()).toMatchObject({
    dungeon: null,
    party: {
      members: [
        {
          id: "player",
          hp: 20,
          mentalFatigue: fatigue,
          status: { physicalFatigue: 0, haze: 150, incapacityRecoverySteps: 6 },
        },
      ],
    },
    clock: { elapsedHalfDays: 1, recoverySteps: 0, pendingAction: null },
    randomState: finalRandom,
  });
  const confirmed = structuredClone(game());
  send({ type: "dungeon", event: { type: "battle", event: { type: "playback", event: { type: "skip" } } } });
  expect(game()).toEqual(confirmed);
  send({ type: "dungeon", event: { type: "battle", event: { type: "finish" } } });
  saveAndLoad();
  openDeparture();
  expect(partyFrame().departure.disabled).toBe(true);
  expect(partyFrame().slots.find(({ member }) => member?.id === "player")?.member).toMatchObject({
    id: "player",
    hp: "HP 20/20",
  });
  expect(partyFrame().status).toContain("出撃できる仲間がいません");
  backFromDeparture();
  for (const [halfDays, steps, haze, remaining, calendar] of [
    [2, 1, 140, 5, "2日目 · 昼"],
    [3, 2, 130, 4, "2日目 · 夜"],
    [4, 3, 120, 3, "3日目 · 昼"],
    [5, 4, 110, 2, "3日目 · 夜"],
    [6, 5, 100, 1, "4日目 · 昼"],
    [7, 6, 90, null, "4日目 · 夜"],
  ] as const) {
    if (entry === "campaign") {
      command("destinations");
      command("town");
    }
    send({ type: "town", event: { type: "select", placeId: "market" } });
    send({ type: "town", event: { type: "advance" } });
    expect(game()).toMatchObject({
      party: {
        members: [{ id: "player", hp: 20, mentalFatigue: 0, status: { haze, incapacityRecoverySteps: remaining } }],
      },
      clock: { elapsedHalfDays: halfDays, recoverySteps: steps, pendingAction: null },
      randomState: finalRandom,
    });
    const frame = entry === "campaign" ? projectCampaign(campaign) : projectDebugSession(debug);
    expect(frame.calendar).toBe(calendar);
    if (entry === "campaign") command("home");
    if (steps === 5) saveAndLoad();
  }
  openDeparture();
  expect(partyFrame().departure.disabled).toBe(false);
  depart();
  expect(game()).toMatchObject({
    dungeon: { currentNodeId: "entrance", outcome: "ongoing" },
    clock: { elapsedHalfDays: 7, recoverySteps: 6 },
    randomState: finalRandom,
  });
  expect(initial).toEqual(original);
});
