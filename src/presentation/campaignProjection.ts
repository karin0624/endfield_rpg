import { characters } from "../content/characters";
import { equipmentCatalog } from "../content/equipmentDefinitions";
import { recoveryItemId } from "../content/itemSettings";
import { grownCharacters } from "../game/growthRuntime";
import { characterById } from "../game/party";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import type { BattleInput } from "./battleModel";
import {
  type CampaignCommand,
  type CampaignContext,
  type CampaignModel,
  campaignDungeonInput,
  campaignPartyModel,
  campaignRules,
  campaignTownInput,
} from "./campaignModel";
import { characterPortraitPath } from "./characterPortrait";
import { projectDungeon } from "./dungeonProjection";
import { projectGrowthChoice } from "./growthProjection";
import { projectParty } from "./partyProjection";
import { calendarLabel, completionFeedback, mentalFatigueText, symptomLabel } from "./statusText";
import { projectTown } from "./townProjection";

interface CommandFrame {
  readonly command: CampaignCommand;
  readonly label: string;
  readonly primary: boolean;
}
export function campaignFeedback(state: Pick<CampaignContext, "game" | "completion">): readonly string[] {
  const { completion, game } = state;
  return [
    ...completionFeedback(completion, characters),
    ...(completion?.lostItems?.length
      ? [`物品ロスト：${completion.lostItems.reduce((sum, item) => sum + item.quantity, 0)}個`]
      : []),
    ...(completion?.returnedIds ?? []).flatMap((id) => {
      const member = game.party.members.find((candidate) => candidate.id === id);
      const label = [
        symptomLabel(member?.status ?? healthyStatus()),
        (member?.mentalFatigue ?? 0) > 0 ? `精神疲労 ${mentalFatigueText(member?.mentalFatigue ?? 0)}` : "",
      ]
        .filter(Boolean)
        .join(" / ");
      return label ? [`${characterById(characters, id).name} · ${label}`] : [];
    }),
  ];
}
export function projectCampaign(state: CampaignModel, enemyDepths: BattleInput["enemyDepths"] = []) {
  const command = (id: CampaignCommand, label: string, primary = false): CommandFrame => ({
    command: id,
    label,
    primary,
  });
  const context = state.context;
  const base = { focus: context.focus, status: context.message, calendar: calendarLabel(context.game.clock) };
  const mode = state.value;
  switch (mode) {
    case "title":
    case "loading":
      return {
        ...base,
        kind: "title" as const,
        title: "ENDFIELD RPG",
        calendar: "",
        copy: [],
        commands: [command("new-game", "新規開始", true), command("load", "続きから")],
        waiting: mode === "loading",
      };
    case "intro":
      return {
        ...base,
        kind: "intro" as const,
        title: "導入",
        calendar: "",
        copy: ["（仮テキスト）"],
        commands: [command("home", "ホームへ", true), command("title", "タイトルへ戻る")],
      };
    case "confirm":
    case "saving": {
      const action = mode === "saving" ? "save" : context.confirmation;
      return {
        ...base,
        kind: "confirm" as const,
        title:
          action === "new-game" ? "新しく始めますか" : action === "title" ? "タイトルへ戻りますか" : "保存しますか",
        copy: [
          action === "new-game"
            ? "新しいプレイを始めます。既存の保存データは、ホームで保存するまで保持されます。"
            : action === "title"
              ? "保存していない変更は失われます。既存の保存データは保持されます。"
              : "同じブラウザの保存スロットを上書きします。",
        ],
        commands: [command("cancel", "取り消す"), command("accept", "実行する", true)],
        waiting: mode === "saving",
      };
    }
    case "home": {
      const leadId = context.game.party.slots.find((id) => id !== null) ?? "player";
      const lead = characterById(characters, leadId);
      const stock = context.game.inventory?.items.home.find(({ itemId }) => itemId === recoveryItemId)?.quantity ?? 0;
      return {
        ...base,
        kind: "home" as const,
        title: "ホーム",
        copy: [`所持金 ${context.game.inventory?.balance ?? 0} · ホーム保管 HP回復品 ${stock}個`],
        feedback: campaignFeedback(context),
        portrait: { name: lead.name, path: characterPortraitPath(leadId) },
        carry: { quantity: context.carryQuantity, stock },
        commands: [
          command("destinations", "探索先を選ぶ", true),
          command("edit-party", "出撃編成を見る"),
          command("equipment", "装備を整える"),
          command("save", "保存"),
          command("save-title", "保存してタイトルへ戻る"),
          command("title", "タイトルへ戻る"),
        ],
      };
    }
    case "equipment": {
      const inventory = context.game.inventory;
      const display = grownCharacters(context.game, campaignRules);
      const members = inventory
        ? context.game.party.members.map((member) => {
            const base = characterById(characters, member.id);
            const stats = display.find(({ id }) => id === member.id) ?? base;
            return {
              id: member.id,
              summary: `${base.name} · HP ${member.hp}/${effectiveMaxHp(stats.maxHp, member.status ?? healthyStatus())} · 攻撃力 ${stats.attackPower}`,
              slots: (["weapon", "armor"] as const).map((slot) => {
                let number = 0;
                return {
                  slot,
                  label: `${base.name}の${slot === "weapon" ? "武器（攻撃力+1）" : "防具（最大HP+4）"}`,
                  selected:
                    inventory.equipment.assignments.find(({ characterId }) => characterId === member.id)?.[slot] ?? "",
                  options: [
                    { value: "", label: "装備なし", disabled: false },
                    ...inventory.equipment.owned
                      .filter((instance) =>
                        equipmentCatalog.some(
                          (definition) => definition.id === instance.definitionId && definition.slot === slot,
                        ),
                      )
                      .map((instance) => {
                        number++;
                        const owner = inventory.equipment.assignments.find(
                          (assignment) =>
                            assignment.weapon === instance.instanceId || assignment.armor === instance.instanceId,
                        );
                        return {
                          value: instance.instanceId,
                          label: `${slot === "weapon" ? "武器" : "防具"} ${number}${owner ? ` · ${characterById(characters, owner.characterId).name}` : ""}`,
                          disabled: owner !== undefined && owner.characterId !== member.id,
                        };
                      }),
                  ],
                };
              }),
            };
          })
        : [];
      return {
        ...base,
        kind: "equipment" as const,
        title: "装備",
        copy: inventory && !inventory.equipment.owned.length ? ["所持している装備はありません。"] : [],
        members,
        commands: [command("home", "ホームへ戻る")],
      };
    }
    case "destinations":
      return {
        ...base,
        kind: "destinations" as const,
        title: "探索先選択",
        copy: ["街探索とダンジョンは、完了時にそれぞれ半日が経過します。"],
        commands: [command("town", "街"), command("prepare-departure", "ダンジョン"), command("home", "ホームへ戻る")],
      };
    case "party": {
      const party = context.party;
      if (!party) throw new Error("Party mode requires its draft");
      return {
        ...base,
        kind: "party" as const,
        title: party.context === "departure" ? "出発準備" : "編成",
        copy: [],
        commands: [],
        party: projectParty(campaignPartyModel(state, party)),
      };
    }
    case "town":
      return {
        ...base,
        kind: "town" as const,
        title: "",
        copy: [],
        commands: [],
        town: projectTown(context.town, campaignTownInput(state), {
          calendar: base.calendar,
          feedback: campaignFeedback(context),
          home: true,
          debug: false,
          editorEntry: false,
          saveStatus: "",
        }),
      };
    case "growth":
      return {
        ...base,
        kind: "growth" as const,
        title: "",
        copy: [],
        commands: [],
        growth: context.game.growth
          ? projectGrowthChoice(
              context.game.growth,
              campaignRules.catalog,
              Object.fromEntries(characters.map(({ id, name }) => [id, name])),
            )
          : null,
      };
    case "dungeon":
      return {
        ...base,
        kind: "dungeon" as const,
        title: "",
        copy: [],
        commands: [],
        dungeon: context.expedition
          ? projectDungeon(context.expedition, campaignDungeonInput(state, enemyDepths), "ホームへ帰還")
          : null,
      };
    case "disposed":
      return { ...base, kind: mode, title: "", copy: [], commands: [] };
  }
}
export type CampaignFrame = ReturnType<typeof projectCampaign>;
