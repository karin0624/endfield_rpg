import { describe, expect, it } from "vitest";
import { characters } from "../content/characters";
import { itemTrials } from "../content/itemTrials";
import { skillCatalog } from "../content/skillDefinitions";
import { changeEquipment, emptyEquipment, equipmentStats } from "./equipment";
import { createParty, getPartyCombatants } from "./party";

const catalog = itemTrials.equipment;
const available = catalog.map((e) => e.id);
describe("ホームの武器1枠・防具1枠", () => {
  it("ホームで両枠へ装備・交換・解除でき、探索中は街でも変更しない", () => {
    const weapon = changeEquipment(emptyEquipment, "home", "weapon", "trial-weapon", available, catalog);
    expect(weapon.accepted).toBe(true);
    const both = changeEquipment(weapon.loadout, "home", "armor", "trial-armor", available, catalog);
    expect(both.loadout).toEqual({ weapon: "trial-weapon", armor: "trial-armor" });
    expect(changeEquipment(both.loadout, "exploration", "weapon", null, available, catalog)).toEqual({
      accepted: false,
      loadout: both.loadout,
    });
    expect(changeEquipment(both.loadout, "home", "weapon", null, available, catalog).loadout).toEqual({
      weapon: null,
      armor: "trial-armor",
    });
  });
  it("枠違い・未提供・未知の装備を拒否する", () => {
    expect(changeEquipment(emptyEquipment, "home", "armor", "trial-weapon", available, catalog).accepted).toBe(false);
    expect(changeEquipment(emptyEquipment, "home", "weapon", "trial-weapon", [], catalog).accepted).toBe(false);
    expect(changeEquipment(emptyEquipment, "home", "weapon", "unknown", ["unknown"], catalog).accepted).toBe(false);
  });
  it("既存能力へ注入補正を投影し、固有技/初期技を装備の有無で制限しない", () => {
    const base = characters[0];
    const projected = equipmentStats(base, { weapon: "trial-weapon", armor: "trial-armor" }, catalog);
    expect(projected).toMatchObject({ maxHp: 24, attackPower: 9, speed: 100 });
    expect(equipmentStats(base, emptyEquipment, catalog)).toMatchObject({ maxHp: 20, attackPower: 8 });
    const party = createParty(characters, [base.id]);
    const before = getPartyCombatants(party, characters, skillCatalog)[0].learnedSkills;
    const after = getPartyCombatants(party, [projected], skillCatalog)[0].learnedSkills;
    expect(before?.length).toBeGreaterThan(0);
    expect(after).toEqual(before);
    expect(
      equipmentStats(base, { weapon: "other", armor: null }, [
        { id: "other", slot: "weapon", bonuses: { maxHp: 0, attackPower: 2 } },
      ]).attackPower,
    ).toBe(10);
  });
});
