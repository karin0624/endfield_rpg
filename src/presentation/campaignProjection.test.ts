import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { applyPartyStatus } from "../game/expedition";
import { createParty } from "../game/party";
import { type CampaignModel, campaignMachine, createCampaignModel, reduceCampaign } from "./campaignModel";
import { projectCampaign } from "./campaignProjection";

const command = (
  state: CampaignModel,
  command: Parameters<typeof reduceCampaign>[1] & {
    type: "command";
  },
) => reduceCampaign(state, command).state;
function home() {
  let state = command(createCampaignModel(), { type: "command", command: "new-game" });
  state = command(state, { type: "command", command: "accept" });
  return command(state, { type: "command", command: "home" });
}
describe("確定した本編画面の読み取り専用投影", () => {
  it("各確認の目的と保存待ちを伝え、装備と出発準備への画面内容を描く", () => {
    const source = home();
    const before = structuredClone(source.context.game);
    for (const [action, title, copy] of [
      ["title", "タイトルへ戻りますか", "保存していない変更は失われます。既存の保存データは保持されます。"],
      ["save", "保存しますか", "同じブラウザの保存スロットを上書きします。"],
      ["save-title", "保存しますか", "同じブラウザの保存スロットを上書きします。"],
    ] as const) {
      const confirmed = command(source, { type: "command", command: action });
      expect(projectCampaign(confirmed)).toMatchObject({ title, copy: [copy], waiting: false });
      if (action !== "title")
        expect(projectCampaign(command(confirmed, { type: "command", command: "accept" }))).toMatchObject({
          title,
          waiting: true,
        });
    }
    expect(projectCampaign(command(createCampaignModel(), { type: "command", command: "load" }))).toMatchObject({
      kind: "title",
      waiting: true,
    });
    expect(
      projectCampaign(
        command(command(source, { type: "command", command: "destinations" }), {
          type: "command",
          command: "prepare-departure",
        }),
      ),
    ).toMatchObject({ kind: "party", title: "出発準備" });
    const equipment = projectCampaign(command(source, { type: "command", command: "equipment" }));
    if (equipment.kind !== "equipment") throw new Error("equipment");
    expect(equipment.members[0].slots[0]).toMatchObject({
      slot: "weapon",
      selected: "",
      options: [
        { value: "", label: "装備なし", disabled: false },
        { value: "weapon-1", label: "武器 1", disabled: false },
        { value: "weapon-2", label: "武器 2", disabled: false },
      ],
    });
    expect(source.context.game).toEqual(before);
  });
  it("帰還の回復・持続症状・疲労と実ロスト個数を別の結果として伝える", () => {
    const initial = home();
    const game = applyPartyStatus(initial.context.game, "player", { kind: "physicalFatigue", amount: 50 }, characters);
    const source: CampaignModel = campaignMachine.resolveState({
      value: initial.value,
      context: {
        ...initial.context,
        game: {
          ...game,
          party: { ...game.party, members: game.party.members.map((member) => ({ ...member, mentalFatigue: 20 })) },
        },
        completion: {
          kind: "dungeon-expedition",
          calendarHalfDays: 1,
          recoverySteps: 0,
          recovery: [],
          returnedIds: ["player"],
          lostItems: [
            { itemId: "hp-recovery", quantity: 2, origin: "carried" },
            { itemId: "trial-material", quantity: 1, origin: "acquired" },
          ],
        },
      },
    });
    const before = structuredClone(source.context);
    expect(projectCampaign(source)).toMatchObject({
      feedback: [
        "出撃者のHPが全回復しました。",
        "物品ロスト：3個",
        "ロッシ · 肉体疲労・中度 · 最大HP × 66.67%（あと街探索5回） / 精神疲労 20（なし）",
      ],
    });
    if (!source.context.completion) throw new Error("completion");
    const healthy: CampaignModel = campaignMachine.resolveState({
      value: source.value,
      context: {
        ...source.context,
        game: initial.context.game,
        completion: { ...source.context.completion, lostItems: [] },
      },
    });
    expect(projectCampaign(healthy)).toMatchObject({ feedback: ["出撃者のHPが全回復しました。"] });
    expect(source.context).toEqual(before);
  });
  it("複数人物への装備割当と装備なしを現在の所持品から表示する", () => {
    const initial = home();
    if (!initial.context.game.inventory) throw new Error("inventory");
    const source: CampaignModel = campaignMachine.resolveState({
      value: initial.value,
      context: {
        ...initial.context,
        game: {
          ...initial.context.game,
          party: createParty(characters, ["player", "gilberta"]),
          inventory: {
            ...initial.context.game.inventory,
            equipment: {
              ...initial.context.game.inventory.equipment,
              assignments: [{ characterId: "player", weapon: "weapon-1", armor: null }],
            },
          },
        },
      },
    });
    const projected = projectCampaign(command(source, { type: "command", command: "equipment" }));
    if (projected.kind !== "equipment") throw new Error("equipment");
    expect(projected.members[0].slots[0]).toMatchObject({ selected: "weapon-1" });
    expect(projected.members[1].slots[0].options[1]).toMatchObject({ label: "武器 1 · ロッシ", disabled: true });
    const empty = command(
      campaignMachine.resolveState({
        value: initial.value,
        context: {
          ...initial.context,
          game: {
            ...initial.context.game,
            inventory: { ...initial.context.game.inventory, equipment: { owned: [], assignments: [] } },
          },
        },
      }),
      { type: "command", command: "equipment" },
    );
    expect(projectCampaign(empty)).toMatchObject({ copy: ["所持している装備はありません。"] });
  });
});
