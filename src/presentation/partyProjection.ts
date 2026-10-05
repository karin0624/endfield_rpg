import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import type { ExpeditionRejection } from "../game/expedition";
import { mentalFatigueLabel } from "../game/mentalFatigue";
import { characterById, departureRejection } from "../game/party";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import { characterPortraitPath } from "./characterPortrait";
import type { PartyModel } from "./partyModel";
import { formatAmount, symptomDescriptions } from "./statusText";

const rejectionText: Record<ExpeditionRejection, string> = {
  "invalid-items": "持込み個数を確認してください。",
  "invalid-slot": "編成枠を選び直してください。",
  "not-joined": "加入済みの仲間を選んでください。",
  "duplicate-member": "同じ仲間は複数の枠に配置できません。先に元の枠を空けてください。",
  "empty-party": "出撃する仲間を1人以上選んでください。",
  "no-living-member": "出撃できる仲間がいません。街探索で回復を進められます。",
  "not-in-town": "編成と出撃は街で行ってください。",
  "action-in-progress": "現在の探索を終えてから出撃してください。",
  "not-on-route": "街へ戻れるのはルート選択中か探索終了後です。",
};
const fullPartyReason = "出撃は4人までです。選択済みの仲間を外すと追加できます。";

export function projectParty(state: PartyModel) {
  const party = state.input.game.party;
  const members = party.members.map((member) => {
    const character = characterById(state.input.characters, member.id);
    const maxHp = effectiveMaxHp(character.maxHp, member.status ?? healthyStatus());
    return {
      id: member.id,
      name: character.name,
      hp: `HP ${formatAmount(member.hp)}/${formatAmount(maxHp)}`,
      ratio: maxHp > 0 ? Math.min(1, Math.max(0, member.hp / maxHp)) : 0,
      symptoms: [
        ...symptomDescriptions(member.status ?? healthyStatus()).map(({ label }) => label),
        (member.mentalFatigue ?? 0) > 0
          ? `精神疲労・${mentalFatigueLabel(member.mentalFatigue ?? 0, mentalFatigueDefinition)}`
          : "",
      ]
        .filter(Boolean)
        .join("　"),
      portrait: state.portraits.failed.includes(member.id) ? undefined : characterPortraitPath(member.id),
    };
  });
  const selection = state.panel.kind === "selection" ? state.panel : null;
  const full = selection?.draft.every((id) => id !== null) ?? false;
  const reason = departureRejection(party);
  return {
    visible: state.panel.kind !== "closed",
    title: state.input.departure ? "出発準備" : "編成",
    calendar: state.input.calendarLabel,
    slots: party.slots.map((id, slot) => ({ slot, member: members.find((member) => member.id === id) ?? null })),
    departure: { visible: !!state.input.departure, disabled: reason !== null },
    status: state.rejection
      ? rejectionText[state.rejection]
      : state.input.departure && reason
        ? rejectionText[reason]
        : "",
    selection: selection
      ? {
          scrollTop: selection.scrollTop,
          status:
            selection.rejection === "full-party"
              ? fullPartyReason
              : selection.rejection
                ? rejectionText[selection.rejection]
                : "",
          candidates: members.map((member) => {
            const number = selection.draft.indexOf(member.id) + 1;
            const unavailable = full && number === 0;
            return {
              ...member,
              number,
              unavailable,
              reason: unavailable ? fullPartyReason : "",
              selectionLabel: number ? `隊列 ${number}` : unavailable ? `未選択。${fullPartyReason}` : "未選択",
            };
          }),
        }
      : null,
    details: state.details,
    focus: state.focus,
    portraitGeneration: state.portraits.generation,
  };
}
export type PartyFrame = ReturnType<typeof projectParty>;
