import { expect, it } from "vitest";
import { confirmPartySelection, createParty, type PartySlots } from "../game/party";
import { togglePartySelection } from "./partySelection";

it("解除で後ろの番号を動かさず、新規選択は最小の空き番号に入り、確定時だけ欠番を詰める", () => {
  const members = ["a", "b", "c", "d", "e"];
  const initial = createParty(
    members.map((id) => ({ id, name: id, maxHp: 20, speed: 100, attackPower: 10 })),
    members,
  );
  const party = { ...initial, slots: ["a", "b", "c", "d"] as PartySlots };
  const before = structuredClone(party);
  let draft: PartySlots = [...party.slots];
  draft = togglePartySelection(draft, "b");
  expect(draft).toEqual(["a", null, "c", "d"]);
  draft = togglePartySelection(draft, "a");
  expect(draft).toEqual([null, null, "c", "d"]);
  draft = togglePartySelection(draft, "e");
  expect(draft).toEqual(["e", null, "c", "d"]);
  expect(party).toEqual(before);
  const result = confirmPartySelection(party, draft);
  expect(result).toMatchObject({ accepted: true, state: { slots: ["e", "c", "d", null] } });
  expect(draft).toEqual(["e", null, "c", "d"]);
});

it("4人選択中に5人目を押しても他メンバーを勝手に外さず、解除後なら追加できる", () => {
  let draft: PartySlots = ["a", "b", "c", "d"];
  draft = togglePartySelection(draft, "e");
  expect(draft).toEqual(["a", "b", "c", "d"]);
  draft = togglePartySelection(draft, "c");
  draft = togglePartySelection(draft, "e");
  expect(draft).toEqual(["a", "b", "e", "d"]);
  for (const id of ["a", "b", "e", "d"]) draft = togglePartySelection(draft, id);
  expect(draft).toEqual([null, null, null, null]);
});
