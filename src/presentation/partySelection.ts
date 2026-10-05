import type { PartySlots } from "../game/party";

/** Draft numbers stay stable until confirmation; newly selected members fill the first gap. */
export function togglePartySelection(draft: PartySlots, id: string): PartySlots {
  const selected = draft.indexOf(id);
  const slot = selected === -1 ? draft.indexOf(null) : selected;
  if (slot === -1) return draft;
  const next: [string | null, string | null, string | null, string | null] = [...draft];
  next[slot] = selected === -1 ? id : null;
  return next;
}
