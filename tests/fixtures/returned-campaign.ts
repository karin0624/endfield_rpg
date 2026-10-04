import type { ExpeditionGame, GameActionCompletion } from "../../src/game/expedition";

/** Confirmed results of the headless campaign scenario, supplied directly for painting. */
export const returnedCampaign = {
  game: {
    adventure: {
      mode: "town",
      currentPlaceId: "market",
      conversationId: null,
      conversationPosition: null,
      flags: ["marked-ruins-route", "scouted-ruins"],
    },
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
    dungeon: null,
    inventory: {
      items: {
        version: 4,
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
      nextActionId: 3,
      pendingAction: null,
    },
    randomState: 2388811721,
    growth: {
      explorationId: "expedition:2",
      closed: true,
      growth: {
        characters: [
          {
            characterId: "player",
            level: 1,
            experience: 0,
            bonus: {
              maxHp: 0,
              attackPower: 0,
            },
            pendingChoiceLevels: [],
          },
          {
            characterId: "gilberta",
            level: 1,
            experience: 0,
            bonus: {
              maxHp: 0,
              attackPower: 0,
            },
            pendingChoiceLevels: [],
          },
        ],
        appliedRewardIds: ["town-exploration", "expedition:2:conversation-b"],
      },
      characters: [
        {
          characterId: "player",
          learned: [
            {
              skillId: "test-strike",
              type: "active",
              origin: "initial",
              acquisition: "initial",
            },
            {
              skillId: "test-heal",
              type: "active",
              origin: "initial",
              acquisition: "initial",
            },
          ],
        },
        {
          characterId: "gilberta",
          learned: [
            {
              skillId: "test-strike",
              type: "active",
              origin: "initial",
              acquisition: "initial",
            },
            {
              skillId: "test-heal",
              type: "active",
              origin: "initial",
              acquisition: "initial",
            },
          ],
        },
      ],
      choice: null,
      randomState: 1587069247,
    },
  },
  completion: {
    id: 2,
    kind: "dungeon-expedition",
    calendarHalfDays: 1,
    recoverySteps: 0,
    lostItems: [],
    recovery: [],
    returnedIds: ["player"],
    outcome: "cleared",
  },
} satisfies { readonly game: ExpeditionGame; readonly completion: GameActionCompletion };
