import { describe, expect, it } from "vitest";

import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "./createInitialGameState";

describe("createInitialGameState", () => {
  it("街から始まる未進行の状態を作る", () => {
    expect(createInitialGameState(initialGameOptions)).toEqual({
      mode: "town",
      currentPlaceId: "town-square",
      conversationId: null,
      conversationPosition: null,
      flags: [],
    });
  });
});
