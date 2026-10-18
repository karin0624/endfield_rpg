import type { ExpeditionGame, GameActionCompletion } from "../../src/game/expedition";

/** Expected public results of the headless campaign scenario. */
export const returnedCampaign = {
  game: {
    party: {
      members: [
        {
          id: "player",
          hp: 20,
          mentalFatigue: 8,
          status: {
            physicalFatigue: 0,
            haze: 0,
            incapacityRecoverySteps: null,
          },
        },
      ],
      slots: ["player", null, null, null],
    },
    inventory: {
      items: {
        home: [],
        importantIds: [],
        exploration: null,
      },
      balance: 30,
      equipment: {
        owned: [
          {
            instanceId: "weapon-1",
            definitionId: "trial-weapon",
          },
          {
            instanceId: "weapon-2",
            definitionId: "trial-weapon",
          },
          {
            instanceId: "armor-1",
            definitionId: "trial-armor",
          },
          {
            instanceId: "armor-2",
            definitionId: "trial-armor",
          },
        ],
        assignments: [],
      },
    },
    clock: {
      elapsedHalfDays: 2,
      recoverySteps: 1,

      pendingAction: null,
    },
  },
  completion: {
    kind: "dungeon-expedition",
    calendarHalfDays: 1,
    recoverySteps: 0,
    lostItems: [],
    recovery: [],
    returnedIds: ["player"],
    outcome: "cleared",
  },
} satisfies {
  readonly game: Pick<ExpeditionGame, "party" | "inventory" | "clock">;
  readonly completion: GameActionCompletion;
};
