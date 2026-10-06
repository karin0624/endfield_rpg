import { characters } from "../content/characters";
import { itemCatalog, recoveryItemId } from "../content/itemSettings";
import { getAvailableDungeonNodes } from "../game/dungeon";
import { previewRecoveryItem } from "../game/itemUse";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import { projectAdventure } from "./adventureProjection";
import { projectBattleActors } from "./battleProjection";
import { projectBattleView } from "./battleViewProjection";
import { branchActors, branchItemCount, branchItemUsable, branchSkills } from "./branchRecoveryModel";
import {
  type DungeonContext,
  type DungeonInput,
  type DungeonModel,
  dungeonAccessibleIds,
  dungeonBattleInput,
} from "./dungeonModel";
import { projectRouteLayout } from "./dungeonRoute";
import { projectGrowthChoice } from "./growthProjection";
import { calendarLabel, formatAmount } from "./statusText";

export const dungeonNodePositions: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {
  "battle-a": { x: 34, y: 34 },
  "conversation-b": { x: 34, y: 66 },
  "boss-c": { x: 74, y: 50 },
};
const nodeAppearances = {
  battle: { title: "戦闘", icon: "battle" },
  conversation: { title: "思わぬ遭遇", icon: "encounter" },
  boss: { title: "ボス", icon: "boss" },
} as const;
export const dungeonNames: Readonly<Record<string, string>> = {
  ...Object.fromEntries(characters.map(({ id, name }) => [id, name])),
  slime: "スライム A",
  "slime-2": "スライム B",
  "ruin-warden": "遺跡の守り手",
};
function projectBranch(context: Pick<DungeonContext, "branch">, input: DungeonInput) {
  const panel = context.branch.panel,
    name = (id: string) => dungeonNames[id] ?? id;
  const targets =
    input.game.dungeon?.party.map((member) => ({
      id: member.id,
      label: `${name(member.id)} · HP ${member.hp}/${effectiveMaxHp(member.maxHp ?? member.hp, member.status ?? healthyStatus())}`,
    })) ?? [];
  const itemTargetId = panel.kind === "item" ? panel.targetId : null;
  const preview = previewRecoveryItem(
    input.game.dungeon?.party.find(({ id }) => id === itemTargetId),
    recoveryItemId,
    itemCatalog,
  );
  const buttons =
    panel.kind === "actor"
      ? branchActors(input).map(({ id }) => ({
          label: name(id),
          event: { type: "actor" as const, id },
          focus: { kind: "actor" as const, id },
          description: "",
        }))
      : panel.kind === "skill"
        ? branchSkills(input, panel.actorId).map((skill) => ({
            label: `${skill.name} · 精神疲労 +${skill.mentalFatigueIncrease}`,
            event: { type: "skill" as const, id: skill.id },
            focus: { kind: "skill" as const, id: skill.id },
            description: `${skill.description} アクティブ／分岐対応。現在の精神疲労 ${input.game.dungeon?.party.find(({ id }) => id === panel.actorId)?.mentalFatigue ?? 0}。使用前の疲労で回復し、その後に負荷と追加発症を計算します。`,
          }))
        : panel.kind === "target"
          ? branchActors(input).map((member) => ({
              label: `${name(member.id)} HP ${formatAmount(member.hp)}/${effectiveMaxHp(member.maxHp ?? member.hp, member.status ?? healthyStatus())}`,
              event: { type: "target" as const, id: member.id },
              focus: { kind: "target" as const, id: member.id },
              description: "",
            }))
          : [];
  return {
    skillVisible: input.rules !== undefined,
    itemVisible: input.items,
    itemLabel: `物品（HP回復品 ×${branchItemCount(input)}）`,
    itemAvailable: branchItemCount(input) > 0,
    panel: panel.kind === "closed" ? null : panel.kind === "item" ? ("item" as const) : ("skill" as const),
    title:
      panel.kind === "actor"
        ? "使用者を選ぶ"
        : panel.kind === "skill"
          ? `${name(panel.actorId)}の技を選ぶ`
          : "回復する味方を選ぶ",
    buttons,
    empty: panel.kind === "actor" ? "回復スキルを使える仲間がいません。" : "分岐で使える回復スキルを習得していません。",
    targets,
    itemTargetId,
    itemPreview: preview.usable
      ? `回復見込み +${preview.amount} HP · 残り${branchItemCount(input)}個`
      : preview.reason === "no-recovery"
        ? "HPは満タンです。使用できません。"
        : "この対象には使用できません。",
    itemUsable: branchItemUsable(context.branch, input),
    focus: context.branch.focus,
  };
}
export type DungeonChromeState = Pick<DungeonModel, "value"> & {
  readonly context: Pick<
    DungeonContext,
    "outcome" | "route" | "branch" | "focus" | "growthFocus" | "message" | "branchResult"
  >;
};
/** Route, conversation, branch and outcome do not depend on battle animation clocks. */
export function projectDungeonChrome(state: DungeonChromeState, input: DungeonInput, returnLabel = "街へ戻る") {
  const context = state.context;
  const dungeon = input.game.dungeon;
  const available = dungeon ? getAvailableDungeonNodes(dungeon, input.route) : [];
  const availableIds = new Set(available.map(({ id }) => id));
  const nodes = input.route.nodes.flatMap((node) => {
    const position = dungeonNodePositions[node.id];
    if (node.type === "start" || !position) return [];
    const appearance = nodeAppearances[node.type];
    const current = dungeon?.currentNodeId === node.id,
      resolved = dungeon?.resolvedNodeIds.includes(node.id) ?? false,
      enabled = availableIds.has(node.id);
    const past =
      !current &&
      !resolved &&
      !enabled &&
      input.route.nodes.some(
        (source) =>
          dungeon?.resolvedNodeIds.includes(source.id) &&
          source.nextNodeIds.includes(node.id) &&
          source.nextNodeIds.some(
            (sibling) =>
              sibling !== node.id && (dungeon.currentNodeId === sibling || dungeon.resolvedNodeIds.includes(sibling)),
          ),
      );
    const status = current ? "現在地" : resolved ? "踏破済み" : enabled ? "選択可能" : "未到達";
    return [
      {
        id: node.id,
        type: node.type,
        position,
        title: past ? null : appearance.title,
        current,
        resolved,
        enabled,
        past,
        status,
        label: `${appearance.title}、${status}`,
        icon: `dungeon-nodes/${enabled ? "focus" : "unfocus"}/${appearance.icon}.png`,
      },
    ];
  });
  const edges = input.route.nodes.flatMap((source) =>
    source.nextNodeIds.map((target) => ({
      from: source.id,
      to: target,
      appearance:
        dungeon?.resolvedNodeIds.includes(source.id) && dungeon.resolvedNodeIds.includes(target)
          ? "resolved"
          : source.id === dungeon?.currentNodeId && availableIds.has(target)
            ? "available"
            : "unavailable",
    })),
  );
  const conversation =
    dungeon?.activity?.type === "conversation"
      ? projectAdventure({
          state: dungeon.activity.state,
          definition: input.adventure,
          calendar: "",
          feedback: [],
          prompt: "",
          focus: null,
        })
      : null;
  const cleared = state.value === "outcome" && context.outcome === "cleared";
  const title = cleared ? "探索を完了しました" : "探索に失敗しました";
  return {
    kind: state.value,
    returnLabel,
    calendar: calendarLabel(input.game.clock),
    focus: context.focus,
    branchResult: context.branchResult,
    route: {
      nodes,
      edges,
      ...projectRouteLayout(context.route, dungeonAccessibleIds(input)),
      dragging: context.route.gesture?.dragging ?? false,
    },
    branch: projectBranch(context, input),
    conversation,
    growth:
      state.value === "growth" && input.rules && input.game.growth
        ? projectGrowthChoice(input.game.growth, input.rules.catalog, dungeonNames)
        : null,
    growthFocus: context.growthFocus,
    outcome: { title, detail: cleared ? "遺跡の守り手を倒し、探索を終えました。" : "味方が全員戦闘不能になりました。" },
    status:
      context.message ||
      (state.value === "outcome"
        ? title
        : `現在地: ${input.route.nodes.find(({ id }) => id === dungeon?.currentNodeId)?.label ?? "不明"}`),
  };
}
export function projectDungeonBattle(state: DungeonModel, input: DungeonInput) {
  const battle = state.value === "battle" ? state.context.battle : null;
  const ready = battle?.scene.status === "ready",
    error = battle?.scene.status === "error";
  const battleView =
    battle && ready
      ? projectBattleView(battle, dungeonBattleInput(input), {
          names: dungeonNames,
          finishLabel: "ルートへ戻る",
          finishAriaLabel: "戦闘を終えてルートへ戻る",
        })
      : null;
  return battle
    ? {
        owner: battle.scene.owner,
        definitions: battle.playback.record.before.combatants,
        actors: projectBattleActors(battle.playback),
        view: battleView,
        status: {
          ready,
          error,
          text: ready
            ? "表示準備完了"
            : error
              ? "戦闘画面を読み込めませんでした。素材とWebGL対応を確認して、再読み込みしてください。"
              : "戦闘画面を読み込んでいます…",
          reason: battle.scene.reason,
        },
        animate:
          ready &&
          (battle.playback.phase !== "finished" || (battleView?.markerId !== null && !battle.playback.reducedMotion)),
      }
    : null;
}
export function projectDungeon(state: DungeonModel, input: DungeonInput, returnLabel = "街へ戻る") {
  return { ...projectDungeonChrome(state, input, returnLabel), battle: projectDungeonBattle(state, input) };
}
export type DungeonChromeFrame = ReturnType<typeof projectDungeonChrome>;
export type DungeonFrame = ReturnType<typeof projectDungeon>;
