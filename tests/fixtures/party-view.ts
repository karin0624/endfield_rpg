import { characters } from "../../src/content/characters";
import { initialAdventure } from "../../src/content/initialAdventure";
import { initialDungeon } from "../../src/content/initialDungeon";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { type CharacterDefinition, characterById, type PartySlots, type PartyState } from "../../src/game/party";
import { effectiveMaxHp, healthyStatus } from "../../src/game/status";
import { reduceCharacterDetails } from "../../src/presentation/characterDetails";
import { createPartyModel, type PartyModel } from "../../src/presentation/partyModel";
import { projectParty } from "../../src/presentation/partyProjection";
import { createPartyView } from "../../src/web/partyView.svelte.ts";
import "../../src/web/style.css";

/** Display inputs only. Rendering a candidate snapshot never runs a game action to reach it. */
export function mountPartyFixture(root: HTMLElement, preset: "approved" | "candidates") {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const approved = preset === "approved";
  const count = approved ? 2 : Number(params.get("count") ?? 24);
  const definitions: CharacterDefinition[] = [
    ...characters.map((character) => ({ ...character, maxHp: approved ? 20 : character.maxHp })),
    ...Array.from({ length: count - characters.length }, (_, index) => ({
      id: `fixture-${index + 3}`,
      name: `仲間 ${index + 3}`,
      maxHp: 200,
      speed: 100,
      attackPower: 8,
    })),
  ];
  if (params.has("long"))
    definitions[definitions.length - 1] = {
      ...definitions[definitions.length - 1],
      name: "長い名前の仲間（折り返しと欠けがないことを確認する表示条件）",
    };
  if (params.has("large-type"))
    definitions[0] = {
      ...definitions[0],
      maxHp: Number.MAX_SAFE_INTEGER,
      name: "長い名前の仲間（精神疲労・戦闘不能・複雑な日本語を確認）",
    };
  if (mode === "details-long") {
    definitions.splice(
      0,
      definitions.length,
      {
        ...characterById(characters, "player"),
        maxHp: 200,
        name: "ロッシ（長い名前の折返しと読みやすさを確認する表示条件）",
      },
      { id: "no-portrait", name: "画像未提供の仲間（表示条件テスト）", maxHp: 200, speed: 100, attackPower: 8 },
    );
  }
  if (mode === "hp-levels")
    definitions.push(
      { id: "empty-hp", name: "HPが空の仲間", maxHp: 20, speed: 100, attackPower: 8 },
      { id: "symptom-hp", name: "最大HP低下中の仲間", maxHp: 20, speed: 100, attackPower: 8 },
    );
  const members = definitions.map((character, index) => {
    const fatigue =
      mode === "details-long"
        ? 25
        : approved
          ? mode === "symptoms" && index === 0
            ? 50
            : character.id === "symptom-hp"
              ? 50
              : 0
          : index === count - 1
            ? 25
            : 0;
    const haze =
      mode === "details-long"
        ? 25
        : approved
          ? mode === "symptoms" && index === 0
            ? 75
            : 0
          : index === count - 1
            ? 25
            : 0;
    const status = { ...healthyStatus(), physicalFatigue: fatigue, haze };
    const hp: Record<string, number> = { player: 20, gilberta: 10, "empty-hp": 0, "symptom-hp": 6.5 };
    return {
      id: character.id,
      hp: mode === "disabled" ? 0 : mode === "hp-levels" ? hp[character.id] : effectiveMaxHp(character.maxHp, status),
      status,
    };
  });
  const slots: PartySlots = [
    definitions[0]?.id ?? null,
    definitions[1]?.id ?? null,
    definitions[2]?.id ?? null,
    definitions[3]?.id ?? null,
  ];
  const party: PartyState = { members, slots };
  const base = createPartyModel(
    {
      game: { adventure: createInitialGameState(initialGameOptions), party, dungeon: null },
      characters: definitions,
      calendarLabel: mode === "details-long" ? "表示条件テスト" : "1日目 · 昼",
      departure: { characters: definitions, route: initialDungeon, adventure: initialAdventure },
    },
    "destinations",
  );
  const draft: PartySlots = params.has("replaced")
    ? [slots[0], definitions[definitions.length - 1].id, slots[2], slots[3]]
    : params.get("candidate") === "unselected"
      ? [null, definitions[1]?.id ?? null, null, null]
      : slots;
  const detailId = params.has("replaced") || params.has("long") ? definitions[definitions.length - 1].id : null;
  let snapshot: PartyModel = {
    ...base,
    focus: detailId ? { kind: "detail", characterId: detailId } : null,
    panel: params.has("selection")
      ? { kind: "selection", draft, openerSlot: 0, scrollTop: 0, rejection: null }
      : { kind: "formation" },
  };
  if (mode === "details-long")
    snapshot = {
      ...snapshot,
      details: reduceCharacterDetails(snapshot.details, {
        type: "open",
        characterId: "player",
        input: { characters: definitions, party },
      }).state,
    };
  // Native hover/pressed/focus modality can prepare a picture, but cannot alter this supplied snapshot.
  const view = createPartyView(root, () => false);
  view.render(
    projectParty(
      params.has("reference-opener") ? { ...snapshot, panel: { kind: "formation" }, focus: null } : snapshot,
    ),
  );
  Object.assign(window, {
    paintPartySelection() {
      view.render(projectParty(snapshot));
    },
    paintPartyScroll(scrollTop: number) {
      if (snapshot.panel.kind === "selection") snapshot = { ...snapshot, panel: { ...snapshot.panel, scrollTop } };
      view.render(projectParty(snapshot));
    },
  });
}
