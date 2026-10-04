import { expect, it } from "vitest";
import { characters } from "../content/characters";
import { initialAdventure } from "../content/initialAdventure";
import { initialGameOptions } from "../content/initialGameOptions";
import { saveDefinitions } from "../content/saveDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import { beginTownExploration } from "../game/expedition";
import { createParty } from "../game/party";
import { DEBUG_SAVE_KEY, GAME_SAVE_KEY, loadSlot, saveSlot, writeSlot } from "./saveSlot";

function game() {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
  };
}
it("保存・読込失敗と会話中の拒否は現在状態と既存保存を保持する", () => {
  const current = game();
  const values = new Map<string, string>([["editor-draft", "keep"]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  expect(loadSlot(current, saveDefinitions, () => storage).message).toBe("保存データがありません。");
  expect(saveSlot(current, saveDefinitions, () => storage)).toBe("保存しました。");
  const original = values.get(GAME_SAVE_KEY);
  const denied = () => {
    throw new Error("denied");
  };
  expect(saveSlot(current, saveDefinitions, denied)).toContain("保存できません");
  expect(saveSlot(current, saveDefinitions, () => ({ ...storage, setItem: denied }))).toContain("保存できません");
  expect(loadSlot(current, saveDefinitions, denied).state).toBeUndefined();
  expect(loadSlot(current, saveDefinitions, () => ({ ...storage, getItem: denied })).state).toBeUndefined();
  const started = beginTownExploration(current, "market", initialAdventure);
  expect(saveSlot(started.state, saveDefinitions, () => storage)).toContain("街に戻って");
  expect(loadSlot(started.state, saveDefinitions, () => storage).state).toBeUndefined();
  expect(values.get(GAME_SAVE_KEY)).toBe(original);
  values.set(GAME_SAVE_KEY, "broken");
  expect(loadSlot(current, saveDefinitions, () => storage).state).toBeUndefined();
  expect(current.party.members[0].hp).toBe(20);
  expect(values.get("editor-draft")).toBe("keep");
  expect(values.get(GAME_SAVE_KEY)).toBe("broken");
});

it("通常v5保存とデバッグ保存を分離し、保存失敗を明示する", () => {
  const values = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
  expect(writeSlot(game(), saveDefinitions, storage).saved).toBe(true);
  const normal = values.get(GAME_SAVE_KEY);
  const started = beginTownExploration(game(), "market", initialAdventure).state;
  expect(writeSlot(started, saveDefinitions, storage, DEBUG_SAVE_KEY).saved).toBe(false);
  expect(loadSlot(game(), saveDefinitions, storage, DEBUG_SAVE_KEY).state).toBeUndefined();
  expect(writeSlot(game(), saveDefinitions, storage, DEBUG_SAVE_KEY).saved).toBe(true);
  expect(values.get(GAME_SAVE_KEY)).toBe(normal);
  expect(loadSlot(game(), saveDefinitions, storage).state?.party.slots).toEqual(["player", null, null, null]);
  expect(
    writeSlot(game(), saveDefinitions, () => {
      throw new Error("denied");
    }).saved,
  ).toBe(false);
  expect(values.get(GAME_SAVE_KEY)).toBe(normal);
});

it("有効な旧v4保存の拒否でも元のスロットと現在セッションを保持する", () => {
  const current = game();
  const before = structuredClone(current);
  const bytes = JSON.stringify({
    version: 4,
    adventure: { currentPlaceId: "town-square", flags: [] },
    party: {
      members: [
        {
          id: "player",
          hp: 20,
          mentalFatigue: 0,
          status: { physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null },
        },
      ],
      slots: ["player", null, null, null],
    },
    clock: { elapsedHalfDays: 0, recoverySteps: 0, nextActionId: 1 },
    randomState: 1,
    growth: null,
  });
  let stored = bytes;
  const result = loadSlot(current, saveDefinitions, () => ({
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  }));
  expect(result.state).toBeUndefined();
  expect(stored).toBe(bytes);
  expect(current).toEqual(before);
});
