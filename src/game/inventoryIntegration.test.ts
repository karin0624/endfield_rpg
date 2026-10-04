import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { itemCatalog, recoveryItemId, recoveryItemOffer } from "../content/itemSettings";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "./createInitialGameState";
import { editHomeEquipment } from "./equipmentRuntime";
import {
  actInExpedition,
  actInTown,
  applyPartyStatus,
  beginTownExploration,
  departOnExpedition,
  type ExpeditionGame,
  leaveExpedition,
} from "./expedition";
import { chooseGrowthSkill, grownCharacters, rewardGrowth } from "./growthRuntime";
import { createInventory } from "./inventory";
import { purchaseItem } from "./itemPurchase";
import { bagItemQuantity, createItemState, receiveItems } from "./items";
import { createParty } from "./party";
import { deserializeGame, serializeGame } from "./save";

const rules = { catalog: skillCatalog, growth: growthRules, fatigue: mentalFatigueDefinition };
function initial(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player", "gilberta"]),
    dungeon: null,
    inventory: createInventory(),
    randomState: 1,
  };
}
function inventoryOf(game: ExpeditionGame) {
  if (!game.inventory) throw new Error("inventory missing");
  return game.inventory;
}
function roundTrip(game: ExpeditionGame) {
  const saved = serializeGame(game, saveDefinitions);
  if (!saved.accepted) throw new Error(saved.reason);
  const read = deserializeGame(saved.data, saveDefinitions);
  if (!read.accepted) throw new Error(read.reason);
  return read.state;
}
function withGear(): ExpeditionGame {
  const game = initial();
  return {
    ...game,
    inventory: {
      ...createInventory(),
      equipment: {
        owned: [
          { instanceId: "w1", definitionId: "trial-weapon" },
          { instanceId: "a1", definitionId: "trial-armor" },
        ],
        assignments: [],
      },
    },
  };
}
describe("本編の物品・装備接続", () => {
  it("市場で買物を複数回しても完了まで時間を進めず、持帰り・保存・持込み・途中帰還が一度だけ反映される", () => {
    let game = beginTownExploration(initial(), "market", initialAdventure).state;
    for (let i = 0; i < 3; i++) {
      if (!game.inventory) throw new Error("inventory");
      const bought = purchaseItem(game.inventory.items, game.inventory.balance, recoveryItemOffer, 1, itemCatalog);
      expect(bought.accepted).toBe(true);
      game = { ...game, inventory: { ...game.inventory, items: bought.items, balance: bought.balance } };
      expect(game.clock?.elapsedHalfDays).toBe(0);
      expect(serializeGame(game, saveDefinitions).accepted).toBe(false);
    }
    const completed = actInTown(game, { type: "advance" }, characters, initialAdventure);
    expect(completed.accepted).toBe(true);
    game = roundTrip(completed.state);
    expect(game.clock?.elapsedHalfDays).toBe(1);
    expect(game.inventory?.balance).toBe(0);
    expect(game.inventory?.items.home).toEqual([{ itemId: recoveryItemId, quantity: 3 }]);
    expect(actInTown(game, { type: "advance" }, characters, initialAdventure).accepted).toBe(false);
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, undefined, [
      { itemId: recoveryItemId, quantity: 2 },
    ]).state;
    expect(game.inventory?.items.home).toEqual([{ itemId: recoveryItemId, quantity: 1 }]);
    const returned = leaveExpedition(game);
    expect(returned.accepted).toBe(true);
    game = roundTrip(returned.state);
    expect(game.inventory?.items.home).toEqual([{ itemId: recoveryItemId, quantity: 3 }]);
    expect(game.randomState).toBe(1586005467);
    expect(game.clock?.elapsedHalfDays).toBe(2);
    expect(leaveExpedition(game).accepted).toBe(false);
  });
  it("戦闘使用は敵行動まで進め、名簿とバッグを確定し、前ノード・同じ入力の再送を拒否する", () => {
    let game = initial();
    game = {
      ...game,
      inventory: {
        ...createInventory(),
        items: createItemState([{ itemId: recoveryItemId, quantity: 2 }], itemCatalog),
      },
    };
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, undefined, [
      { itemId: recoveryItemId, quantity: 2 },
    ]).state;
    game = actInExpedition(game, { type: "enter", nodeId: "battle-a" }, initialDungeon, initialAdventure).state;
    game = actInExpedition(
      game,
      { type: "attack", actorId: "player", targetId: "slime" },
      initialDungeon,
      initialAdventure,
    ).state;
    const battle = game.dungeon?.activity;
    if (battle?.type !== "battle" || !game.inventory) throw new Error("battle");
    const input = {
      type: "item" as const,
      actorId: "player",
      targetId: "player",
      itemId: recoveryItemId,
      expectedActionTime: battle.state.logicalTime,
      expectedNodeId: "battle-a",
      expectedVersion: game.inventory.items.version,
      explorationId: game.dungeon?.expeditionActionId ?? -1,
    };
    expect(
      actInExpedition(game, { ...input, expectedNodeId: "entrance" }, initialDungeon, initialAdventure).result.accepted,
    ).toBe(false);
    const used = actInExpedition(game, input, initialDungeon, initialAdventure);
    expect(used.result.accepted).toBe(true);
    if (used.result.accepted) {
      expect(used.result.itemRecovery).toEqual({
        type: "item-recovery",
        itemId: recoveryItemId,
        actorId: "player",
        targetId: "player",
        amount: 7,
      });
      expect(used.result.events).toEqual([
        { type: "attack", actorId: "slime", targetId: "player", damage: 4, targetHpBefore: 20, targetHpAfter: 16 },
        { type: "attack", actorId: "slime-2", targetId: "player", damage: 3, targetHpBefore: 16, targetHpAfter: 13 },
      ]);
    }
    expect(used.state.party.members[0].hp).toBe(13);
    expect(used.state.party.members[1].hp).toBe(18);
    expect(used.state.randomState).toBe(1);
    expect(used.state.inventory && bagItemQuantity(used.state.inventory.items, recoveryItemId)).toBe(1);
    expect(used.state.party.members[0].mentalFatigue ?? 0).toBe(0);
    expect(actInExpedition(used.state, input, initialDungeon, initialAdventure).result.accepted).toBe(false);
  });
  it("共有実物は同時装備不可で、装着で回復せず、解除時はHP上限へ収める", () => {
    let game = editHomeEquipment(withGear(), "home", "player", "armor", "a1", characters, rules).state;
    expect(game.party.members[0].hp).toBe(20);
    expect(grownCharacters(game, rules)[0].maxHp).toBe(24);
    expect(editHomeEquipment(game, "home", "gilberta", "armor", "a1", characters, rules).accepted).toBe(false);
    expect(editHomeEquipment(game, "exploration", "player", "armor", null, characters, rules).accepted).toBe(false);
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    expect(editHomeEquipment(game, "home", "player", "armor", null, characters, rules).accepted).toBe(false);
    game = leaveExpedition(game, rules).state;
    expect(game.party.members[0].hp).toBe(24);
    expect(game.inventory?.equipment.owned).toHaveLength(2);
    game = roundTrip(game);
    game = editHomeEquipment(game, "home", "player", "armor", null, characters, rules).state;
    expect(game.party.members[0].hp).toBe(20);
    expect(editHomeEquipment(game, "home", "gilberta", "armor", "a1", characters, rules).accepted).toBe(true);
  });
  it("装備補正を戦闘・帰還・保存・再出発で二重に加算しない", () => {
    let game = editHomeEquipment(withGear(), "home", "player", "weapon", "w1", characters, rules).state;
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    expect(game.dungeon?.party[0].attackPower).toBe(9);
    game = leaveExpedition(game, rules).state;
    game = roundTrip(game);
    expect(grownCharacters(game, rules)[0].attackPower).toBe(9);
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    expect(game.dungeon?.party[0].attackPower).toBe(9);
  });
  it("旧形式・負数・未知物品・装備の重複割当てを保存復元で拒否する", () => {
    const saved = serializeGame(withGear(), saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    for (const mutate of [
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.version = 4;
      },
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.inventory.balance = -1;
      },
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.inventory.items.home = [{ itemId: "unknown", quantity: 1 }];
      },
      (v: {
        version: number;
        inventory: {
          balance: number;
          items: { home: { itemId: string; quantity: number }[] };
          equipment: { assignments: { characterId: string; weapon: string | null; armor: string | null }[] };
        };
      }) => {
        v.inventory.equipment.assignments = [
          { characterId: "player", weapon: "w1", armor: null },
          { characterId: "gilberta", weapon: "w1", armor: null },
        ];
      },
    ]) {
      const payload = JSON.parse(saved.data);
      mutate(payload);
      expect(deserializeGame(JSON.stringify(payload), saveDefinitions).accepted).toBe(false);
    }
  });
});

describe("物品・装備の保存契約", () => {
  it.each([
    ["ゼロ個の保管", "items.home", [{ itemId: recoveryItemId, quantity: 0 }]],
    ["端数個の保管", "items.home", [{ itemId: recoveryItemId, quantity: 1.5 }]],
    [
      "同じ品目の二重保管",
      "items.home",
      [
        { itemId: recoveryItemId, quantity: 1 },
        { itemId: recoveryItemId, quantity: 2 },
      ],
    ],
    ["未知の装備定義", "equipment.owned", [{ instanceId: "w1", definitionId: "unknown" }]],
    ["空の実物ID", "equipment.owned", [{ instanceId: "  ", definitionId: "trial-weapon" }]],
    [
      "重複した実物ID",
      "equipment.owned",
      [
        { instanceId: "w1", definitionId: "trial-weapon" },
        { instanceId: "w1", definitionId: "trial-weapon" },
      ],
    ],
    ["所持しない実物の装備", "equipment.assignments", [{ characterId: "player", weapon: "missing", armor: null }]],
    ["防具を武器枠へ配置", "equipment.assignments", [{ characterId: "player", weapon: "a1", armor: null }]],
    ["武器を防具枠へ配置", "equipment.assignments", [{ characterId: "player", weapon: null, armor: "w1" }]],
    ["未加入キャラへの配置", "equipment.assignments", [{ characterId: "missing", weapon: "w1", armor: null }]],
    [
      "同じキャラへの二重行",
      "equipment.assignments",
      [
        { characterId: "player", weapon: "w1", armor: null },
        { characterId: "player", weapon: null, armor: "a1" },
      ],
    ],
  ])("%sを復元時に拒否する", (_label, path, replacement) => {
    const saved = serializeGame(withGear(), saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    const payload = JSON.parse(saved.data);
    const [group, field] = String(path).split(".");
    payload.inventory[group][field] = replacement;
    expect(deserializeGame(JSON.stringify(payload), saveDefinitions)).toEqual({
      accepted: false,
      reason: "invalid-data",
    });
  });

  it("保存読込は消耗品・所持金・共有装備を初期配布で補充しない", () => {
    const game = {
      ...initial(),
      inventory: {
        balance: 0,
        items: createItemState([], itemCatalog),
        equipment: { owned: [], assignments: [] },
      },
    };
    const loaded = roundTrip(game);
    expect(loaded.inventory).toEqual({
      balance: 0,
      items: { version: 0, home: [], importantIds: [], exploration: null },
      equipment: { owned: [], assignments: [] },
    });
  });
});

describe("本編在庫の初期値・保存境界・装備制約", () => {
  it("初回だけ所持金30と装備2組を配布し、消耗品と割当ては空で開始する", () => {
    expect(createInventory()).toEqual({
      balance: 30,
      items: { version: 0, home: [], importantIds: [], exploration: null },
      equipment: {
        owned: [
          { instanceId: "weapon-1", definitionId: "trial-weapon" },
          { instanceId: "weapon-2", definitionId: "trial-weapon" },
          { instanceId: "armor-1", definitionId: "trial-armor" },
          { instanceId: "armor-2", definitionId: "trial-armor" },
        ],
        assignments: [],
      },
    });
  });
  it("所持金・物品版・保管数量・未定義品と探索バッグの外部保存を拒否する", () => {
    const saved = serializeGame(initial(), saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    const cases: [string[], unknown][] = [
      ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, "1"].flatMap((value): [string[], unknown][] => [
        [["balance"], value],
        [["items", "version"], value],
        [["items", "home"], [{ itemId: recoveryItemId, quantity: value }]],
      ]),
      [["items", "exploration"], { id: 1, destination: "dungeon", bag: [], rewardIds: [] }],
      [["items", "importantIds"], ["trial-important"]],
      [["items", "home"], [{ itemId: "trial-material", quantity: 1 }]],
      [["items", "home"], null],
      [["items", "home"], [{ itemId: recoveryItemId }]],
      [["items", "home"], [{ itemId: recoveryItemId, quantity: 1, extra: true }]],
      [["items", "importantIds"], {}],
      [["equipment", "owned"], null],
      [["equipment", "owned"], [{ instanceId: "w1" }]],
      [["equipment", "owned"], [{ instanceId: 1, definitionId: "trial-weapon" }]],
      [["equipment", "owned"], [{ instanceId: "w1", definitionId: "trial-weapon", extra: 1 }]],
      [["equipment", "assignments"], null],
      [["equipment", "assignments"], [{ characterId: "player", weapon: "weapon-1" }]],
      [["equipment", "assignments"], [{ characterId: "player", weapon: 1, armor: null }]],
      [["equipment", "assignments"], [{ characterId: "player", weapon: null, armor: null, extra: 1 }]],
    ];
    for (const [path, value] of cases) {
      const payload = JSON.parse(saved.data);
      let object = payload.inventory;
      for (const key of path.slice(0, -1)) object = object[key];
      object[path[path.length - 1]] = value;
      expect(deserializeGame(JSON.stringify(payload), saveDefinitions), path.join(".")).toEqual({
        accepted: false,
        reason: "invalid-data",
      });
    }
    for (const path of [[], ["items"], ["equipment"]]) {
      const payload = JSON.parse(saved.data);
      let object = payload.inventory;
      for (const key of path) object = object[key];
      object.extra = true;
      expect(deserializeGame(JSON.stringify(payload), saveDefinitions)).toEqual({
        accepted: false,
        reason: "invalid-data",
      });
    }
  });
  it("市場探索中と未加入者・未知者・所持外・枠違いの装備編集を原子的に拒否する", () => {
    const game = withGear();
    const snapshot = structuredClone(game);
    for (const [characterId, slot, instanceId] of [
      ["missing", "weapon", "w1"],
      ["player", "weapon", "unknown"],
      ["player", "weapon", "a1"],
      ["player", "armor", "w1"],
    ] as const)
      expect(editHomeEquipment(game, "home", characterId, slot, instanceId, characters, rules)).toEqual({
        accepted: false,
        state: snapshot,
      });
    const solo = { ...game, party: createParty(characters, ["player"]) };
    expect(editHomeEquipment(solo, "home", "gilberta", "weapon", "w1", characters, rules)).toEqual({
      accepted: false,
      state: solo,
    });
    const town = beginTownExploration(game, "market", initialAdventure).state;
    const townBefore = structuredClone(town);
    expect(editHomeEquipment(town, "home", "player", "weapon", "w1", characters, rules)).toEqual({
      accepted: false,
      state: townBefore,
    });
    expect(game).toEqual(snapshot);
  });
  it("装備交換と保存は負傷・症状・控えを保ち、装備を再配布せず物品版も保持する", () => {
    let game = editHomeEquipment(withGear(), "home", "player", "armor", "a1", characters, rules).state;
    game = editHomeEquipment(game, "home", "player", "weapon", "w1", characters, rules).state;
    game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 100 }, characters);
    game = applyPartyStatus(game, "gilberta", { kind: "incapacity" }, characters);
    // Public save input represents an injured player under the effective gear cap 12.
    const saved = serializeGame(game, saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    const payload = JSON.parse(saved.data);
    payload.party.members[0].hp = 7;
    payload.inventory.items.version = 9;
    payload.inventory.items.home = [{ itemId: recoveryItemId, quantity: 3 }];
    payload.inventory.balance = 4;
    payload.randomState = 1234;
    const read = deserializeGame(JSON.stringify(payload), saveDefinitions);
    if (!read.accepted) throw new Error(read.reason);
    game = roundTrip(read.state);
    expect(game.inventory).toEqual({
      balance: 4,
      items: { version: 9, home: [{ itemId: recoveryItemId, quantity: 3 }], importantIds: [], exploration: null },
      equipment: {
        owned: [
          { instanceId: "w1", definitionId: "trial-weapon" },
          { instanceId: "a1", definitionId: "trial-armor" },
        ],
        assignments: [{ characterId: "player", weapon: "w1", armor: "a1" }],
      },
    });
    expect(game.randomState).toBe(1234);
    expect(game.party.members[0]).toMatchObject({ hp: 7, status: { physicalFatigue: 100 } });
    const before = structuredClone(game);
    const removed = editHomeEquipment(game, "home", "player", "armor", null, characters, rules);
    expect(removed.accepted).toBe(true);
    expect(removed.state.party).toEqual(before.party);
    expect(removed.state.inventory?.equipment.assignments).toEqual([
      { characterId: "player", weapon: "w1", armor: null },
    ]);
    payload.party.members[0].hp = 12;
    const atCap = deserializeGame(JSON.stringify(payload), saveDefinitions);
    if (!atCap.accepted) throw new Error(atCap.reason);
    expect(
      editHomeEquipment(atCap.state, "home", "player", "armor", null, characters, rules).state.party.members[0].hp,
    ).toBe(10);
    payload.party.members[0].hp = 12.001;
    expect(deserializeGame(JSON.stringify(payload), saveDefinitions)).toEqual({
      accepted: false,
      reason: "invalid-data",
    });
  });
});

function gainOneLevel(game: ExpeditionGame) {
  const reward = rewardGrowth(
    game,
    { id: "item-integration-xp", allocations: [{ characterId: "player", experience: 10 }] },
    rules,
  );
  if (!reward.accepted) throw new Error(reward.reason);
  const choice = reward.state.growth?.choice;
  const skillId = choice?.candidateIds.find((id) => id !== "test-vitality" && id !== "test-power");
  if (!choice || !skillId || !reward.state.growth) throw new Error("choice missing");
  const selected = chooseGrowthSkill(reward.state, skillId, rules);
  if (!selected.accepted) throw new Error(selected.reason);
  return selected.state;
}

describe("装備・成長・物品の複合状態", () => {
  it("装備と成長を合算してから肉体疲労を掛け、保存上限・戦闘・装備解除・帰還へ同じ順序を使う", () => {
    let game = editHomeEquipment(withGear(), "home", "player", "armor", "a1", characters, rules).state;
    game = editHomeEquipment(game, "home", "player", "weapon", "w1", characters, rules).state;
    game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 100 }, characters);
    game = gainOneLevel(game);
    expect(grownCharacters(game, rules)[0]).toMatchObject({ maxHp: 28, attackPower: 10, speed: 100 });
    expect(game.party.members[0].hp).toBe(14); // (20 base + 4 armor + 4 level) * .5
    game = roundTrip(game);
    const saved = serializeGame(game, saveDefinitions);
    if (!saved.accepted) throw new Error(saved.reason);
    const payload = JSON.parse(saved.data);
    payload.party.members[0].hp = 14.001;
    expect(deserializeGame(JSON.stringify(payload), saveDefinitions)).toEqual({
      accepted: false,
      reason: "invalid-data",
    });
    payload.party.members[0].hp = 9;
    const injured = deserializeGame(JSON.stringify(payload), saveDefinitions);
    if (!injured.accepted) throw new Error(injured.reason);
    expect(roundTrip(injured.state).party.members[0].hp).toBe(9);
    const removed = editHomeEquipment(game, "home", "player", "armor", null, characters, rules);
    expect(removed.accepted).toBe(true);
    expect(removed.state.party.members[0].hp).toBe(12); // (20 base + 4 level) * .5
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules).state;
    game = actInExpedition(game, { type: "enter", nodeId: "battle-a" }, initialDungeon, initialAdventure, rules).state;
    if (game.dungeon?.activity?.type !== "battle") throw new Error("battle missing");
    expect(game.dungeon.activity.state.combatants[0]).toMatchObject({
      hp: 14,
      maxHp: 28,
      attackPower: 10,
      status: { physicalFatigue: 100 },
    });
    // A separate public departure returns before entering battle to isolate projection on return.
    let returning = departOnExpedition(
      roundTrip(injured.state),
      characters,
      initialDungeon,
      initialAdventure,
      rules,
    ).state;
    returning = leaveExpedition(returning, rules).state;
    expect(returning.party.members[0]).toMatchObject({ hp: 12, status: { physicalFatigue: 100 } });
    expect(grownCharacters(roundTrip(returning), rules)[0]).toMatchObject({ maxHp: 24, attackPower: 9 });
  });
  it("未解決の成長選択は物品使用とホーム装備編集の両方を拒否する", () => {
    let game = withGear();
    game = {
      ...game,
      inventory: {
        ...inventoryOf(game),
        items: createItemState([{ itemId: recoveryItemId, quantity: 2 }], itemCatalog),
      },
    };
    game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules, [
      { itemId: recoveryItemId, quantity: 2 },
    ]).state;
    const reward = rewardGrowth(
      game,
      { id: "pending-item-test", allocations: [{ characterId: "player", experience: 10 }] },
      rules,
    );
    if (!reward.accepted) throw new Error(reward.reason);
    game = reward.state;
    const snapshot = structuredClone(game);
    const result = actInExpedition(
      game,
      {
        type: "branch-item",
        expectedNodeId: "entrance",
        expectedVersion: 1,
        explorationId: 1,
        itemId: recoveryItemId,
        targetId: "player",
      },
      initialDungeon,
      initialAdventure,
      rules,
    );
    expect(result.result).toMatchObject({ accepted: false, reason: "pending-growth-choice" });
    expect(result.state).toEqual(snapshot);
    // A public growth reward at home also leaves a choice pending, without dungeon/location guards.
    const homeReward = rewardGrowth(
      withGear(),
      { id: "home-pending", allocations: [{ characterId: "player", experience: 10 }] },
      rules,
    );
    if (!homeReward.accepted) throw new Error(homeReward.reason);
    expect(editHomeEquipment(homeReward.state, "home", "player", "weapon", "w1", characters, rules)).toEqual({
      accepted: false,
      state: homeReward.state,
    });
  });
});

it("公開物品APIで受理した最大安全整数の金額と数量を保存復元する", () => {
  const game = {
    ...initial(),
    inventory: {
      ...createInventory(),
      balance: Number.MAX_SAFE_INTEGER,
      items: createItemState([{ itemId: recoveryItemId, quantity: Number.MAX_SAFE_INTEGER }], itemCatalog),
    },
  };
  const loaded = roundTrip(game);
  expect(loaded.inventory?.balance).toBe(9007199254740991);
  expect(loaded.inventory?.items.home).toEqual([{ itemId: recoveryItemId, quantity: 9007199254740991 }]);
});

it("分岐物品と装備操作は非ゼロの生活時計・成長・控えの療養・フラグを進めない", () => {
  let game = beginTownExploration(withGear(), "market", initialAdventure).state;
  game = actInTown(game, { type: "advance" }, characters, initialAdventure).state;
  game = applyPartyStatus(game, "gilberta", { kind: "incapacity" }, characters);
  const saved = serializeGame(game, saveDefinitions);
  if (!saved.accepted) throw new Error(saved.reason);
  const payload = JSON.parse(saved.data);
  payload.party.members[0].hp = 5;
  payload.adventure.flags = ["found-path"];
  payload.inventory.items.home = [{ itemId: recoveryItemId, quantity: 2 }];
  const restored = deserializeGame(JSON.stringify(payload), saveDefinitions);
  if (!restored.accepted) throw new Error(restored.reason);
  game = gainOneLevel(restored.state);
  const homeBefore = structuredClone(game);
  game = editHomeEquipment(game, "home", "player", "weapon", "w1", characters, rules).state;
  expect(game.party).toEqual(homeBefore.party);
  expect(game.clock).toEqual({ elapsedHalfDays: 1, recoverySteps: 1, nextActionId: 2, pendingAction: null });
  game = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules, [
    { itemId: recoveryItemId, quantity: 2 },
  ]).state;
  const before = structuredClone(game);
  const used = actInExpedition(
    game,
    {
      type: "branch-item",
      itemId: recoveryItemId,
      targetId: "player",
      expectedVersion: 3,
      explorationId: 2,
      expectedNodeId: "entrance",
    },
    initialDungeon,
    initialAdventure,
    rules,
  );
  expect(used.result.accepted).toBe(true);
  expect(used.state.party.members[0].hp).toBe(17);
  expect(used.state.party.members[1]).toEqual(before.party.members[1]);
  expect(used.state.party.members[1].status?.incapacityRecoverySteps).toBe(6);
  expect(used.state.growth).toEqual(before.growth);
  expect(used.state.clock).toEqual({
    elapsedHalfDays: 1,
    recoverySteps: 1,
    nextActionId: 3,
    pendingAction: { id: 2, kind: "dungeon-expedition" },
  });
  expect(used.state.adventure.flags).toEqual(["found-path"]);
  expect(used.state.dungeon).toEqual({ ...before.dungeon, party: [{ ...before.dungeon?.party[0], hp: 17 }] });
  expect(used.state.randomState).toBe(before.randomState);
  expect(used.state.inventory?.items).toEqual({
    ...inventoryOf(before).items,
    version: 4,
    exploration: {
      ...inventoryOf(before).items.exploration,
      bag: [{ itemId: recoveryItemId, quantity: 1, origin: "carried" }],
    },
  });
});

it.each(["cleared", "defeat"] as const)("%sは非空バッグ・装備・成長を帰還時に一度だけ確定する", (outcome) => {
  const route = {
    id: "inventory-outcomes",
    entryNodeId: "start",
    nodes: [
      { id: "start", label: "開始", type: "start" as const, nextNodeIds: ["boss"] },
      {
        id: "boss",
        label: "ボス",
        type: "boss" as const,
        nextNodeIds: [],
        enemies: [
          { id: "enemy", team: "enemy" as const, speed: 90, hp: outcome === "cleared" ? 1 : 1000, attackPower: 100 },
        ],
      },
    ],
  };
  let game = editHomeEquipment(withGear(), "home", "player", "armor", "a1", characters, rules).state;
  game = gainOneLevel(game);
  game = {
    ...game,
    randomState: 1,
    inventory: { ...inventoryOf(game), items: createItemState([{ itemId: recoveryItemId, quantity: 5 }], itemCatalog) },
  };
  const equipment = structuredClone(game.inventory?.equipment);
  game = departOnExpedition(game, characters, route, initialAdventure, rules, [
    { itemId: recoveryItemId, quantity: 3 },
  ]).state;
  const reward = receiveItems(
    inventoryOf(game).items,
    1,
    "event-loot",
    [{ itemId: recoveryItemId, quantity: 2 }],
    itemCatalog,
  );
  if (!reward.accepted) throw new Error(reward.reason);
  game = { ...game, inventory: { ...inventoryOf(game), items: reward.state } };
  game = actInExpedition(game, { type: "enter", nodeId: "boss" }, route, initialAdventure, rules).state;
  const fought = actInExpedition(
    game,
    { type: "attack", actorId: "player", targetId: "enemy" },
    route,
    initialAdventure,
    rules,
  );
  expect(fought.result.accepted).toBe(true);
  game = fought.state;
  if (outcome === "cleared") {
    expect(game.dungeon?.outcome).toBe("cleared");
    const branch = actInExpedition(
      game,
      {
        type: "branch-item",
        itemId: recoveryItemId,
        targetId: "player",
        expectedVersion: 2,
        explorationId: 1,
        expectedNodeId: "boss",
      },
      route,
      initialAdventure,
      rules,
    );
    expect(branch.result.accepted).toBe(false);
    expect(branch.state).toEqual(game);
    const returned = leaveExpedition(game, rules);
    expect(returned.accepted).toBe(true);
    if (!returned.accepted) throw new Error(returned.reason);
    expect(returned.completion?.lostItems).toEqual([]);
    game = returned.state;
  } else {
    expect(fought.completion?.lostItems).toEqual([
      { itemId: recoveryItemId, quantity: 1, origin: "carried" },
      { itemId: recoveryItemId, quantity: 1, origin: "acquired" },
    ]);
  }
  expect(game.dungeon).toBeNull();
  expect(game.inventory?.items).toEqual({
    version: 3,
    home: [{ itemId: recoveryItemId, quantity: outcome === "cleared" ? 7 : 5 }],
    importantIds: [],
    exploration: null,
  });
  expect(game.inventory?.equipment).toEqual(equipment);
  expect(game.randomState).toBe(outcome === "cleared" ? 1 : 217083232);
  expect(game.party.members[0].hp).toBe(24);
  expect(game.growth?.growth.characters[0]).toMatchObject({
    level: 1,
    experience: 0,
    bonus: { maxHp: 0, attackPower: 0 },
  });
  expect(game.clock).toEqual({ elapsedHalfDays: 1, recoverySteps: 0, nextActionId: 2, pendingAction: null });
  expect(leaveExpedition(game, rules)).toMatchObject({ accepted: false, state: game });
  expect(roundTrip(game).inventory).toEqual(game.inventory);
});

it("別戦闘と再出発の同じ論理時刻でも前の物品入力を再利用できない", () => {
  const route = {
    id: "item-stale-battle",
    entryNodeId: "start",
    nodes: [
      { id: "start", label: "入口", type: "start" as const, nextNodeIds: ["first"] },
      {
        id: "first",
        label: "第一戦",
        type: "battle" as const,
        nextNodeIds: ["second"],
        enemies: [{ id: "enemy", team: "enemy" as const, speed: 90, hp: 1, attackPower: 1 }],
      },
      {
        id: "second",
        label: "最終戦",
        type: "boss" as const,
        nextNodeIds: [],
        enemies: [{ id: "enemy", team: "enemy" as const, speed: 90, hp: 1, attackPower: 1 }],
      },
    ],
  };
  const saved = serializeGame(initial(), saveDefinitions);
  if (!saved.accepted) throw new Error(saved.reason);
  const payload = JSON.parse(saved.data);
  payload.party.members[0].hp = 5;
  payload.inventory.items.home = [{ itemId: recoveryItemId, quantity: 2 }];
  const read = deserializeGame(JSON.stringify(payload), saveDefinitions);
  if (!read.accepted) throw new Error(read.reason);
  let game = departOnExpedition(read.state, characters, route, initialAdventure, undefined, [
    { itemId: recoveryItemId, quantity: 2 },
  ]).state;
  game = actInExpedition(game, { type: "enter", nodeId: "first" }, route, initialAdventure).state;
  const command = {
    type: "item" as const,
    itemId: recoveryItemId,
    targetId: "player",
    actorId: "player",
    expectedVersion: 1,
    explorationId: 1,
    expectedNodeId: "first",
    expectedActionTime: 100,
  };
  game = actInExpedition(game, { type: "attack", actorId: "player", targetId: "enemy" }, route, initialAdventure).state;
  game = actInExpedition(game, { type: "enter", nodeId: "second" }, route, initialAdventure).state;
  if (game.dungeon?.activity?.type !== "battle") throw new Error("battle missing");
  expect(game.dungeon.activity.state.logicalTime).toBe(100);
  expect(game.party.members[0].hp).toBe(5);
  let before = structuredClone(game);
  const otherBattle = actInExpedition(game, command, route, initialAdventure);
  expect(otherBattle.result.accepted).toBe(false);
  expect(otherBattle.state).toEqual(before);
  game = actInExpedition(game, { type: "attack", actorId: "player", targetId: "enemy" }, route, initialAdventure).state;
  game = leaveExpedition(game).state;
  game = departOnExpedition(game, characters, route, initialAdventure, undefined, [
    { itemId: recoveryItemId, quantity: 2 },
  ]).state;
  game = actInExpedition(game, { type: "enter", nodeId: "first" }, route, initialAdventure).state;
  if (game.dungeon?.activity?.type !== "battle") throw new Error("battle missing");
  expect(game.dungeon.activity.state.logicalTime).toBe(100);
  before = structuredClone(game);
  for (const stale of [command, { ...command, expectedVersion: inventoryOf(game).items.version }]) {
    const replay = actInExpedition(game, stale, route, initialAdventure);
    expect(replay.result.accepted).toBe(false);
    expect(replay.state).toEqual(before);
  }
});
