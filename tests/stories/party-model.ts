import { characters } from "../../src/content/characters";
import { growthRules } from "../../src/content/growthRules";
import { initialAdventure } from "../../src/content/initialAdventure";
import { initialDungeon } from "../../src/content/initialDungeon";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { mentalFatigueDefinition } from "../../src/content/mentalFatigueDefinition";
import { skillCatalog } from "../../src/content/skillDefinitions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import type { PartySlots, PartyState } from "../../src/game/party";
import { effectiveMaxHp, healthyStatus } from "../../src/game/status";
import { reduceCharacterDetails } from "../../src/presentation/characterDetails";
import { createPartyModel, type PartyModel } from "../../src/presentation/partyModel";
import { projectParty } from "../../src/presentation/partyProjection";

/** Source views receive fixed public display inputs; pointer states never advance the game. */
export function partyModel(
  props: Record<string, unknown> = {},
  panel: "formation" | "selection" | "details" = "formation",
) {
  const joined = props.members === 1 ? characters.slice(0, 1) : characters;
  const members = joined.map((character) => {
    const status = {
      ...healthyStatus(),
      physicalFatigue: props.symptoms && character.id === String(props.symptomsCharacterId ?? "player") ? 50 : 0,
      haze: props.symptoms && character.id === String(props.symptomsCharacterId ?? "player") ? 75 : 0,
    };
    return {
      id: character.id,
      hp: props.disabled ? 0 : effectiveMaxHp(character.maxHp, status) * Number(props.ratio ?? 1),
      status,
      mentalFatigue: props.symptoms && character.id === String(props.symptomsCharacterId ?? "player") ? 25 : 0,
    };
  });
  const slots: PartySlots = props.empty
    ? [null, null, null, null]
    : [joined[0]?.id ?? null, joined[1]?.id ?? null, null, null];
  const party: PartyState = { members, slots };
  const catalog =
    props.skills === "empty" || props.skills === "unconnected"
      ? {
          ...skillCatalog,
          characters: skillCatalog.characters.map((profile) =>
            profile.characterId === String(props.characterId ?? "player")
              ? { ...profile, initialSkillIds: props.skills === "empty" ? [] : null }
              : profile,
          ),
        }
      : skillCatalog;
  let snapshot: PartyModel = createPartyModel(
    {
      game: { adventure: createInitialGameState(initialGameOptions), party, dungeon: null },
      characters,
      calendarLabel: "1日目 · 昼",
      ...(props.edit ? {} : { departure: { characters, route: initialDungeon, adventure: initialAdventure } }),
      detailsContext: {
        characters,
        baseCharacters: characters,
        growth: undefined,
        rules: {
          catalog,
          fatigue: mentalFatigueDefinition,
          growth: { ...growthRules, characters },
        },
      },
    },
    props.edit ? "home" : "destinations",
  );
  snapshot = {
    ...snapshot,
    focus: null,
    portraits: {
      generation: 0,
      failed: props.failedPortrait ? [props.failedPortrait === "gilberta" ? "gilberta" : "player"] : [],
    },
    ...(panel === "formation"
      ? {}
      : {
          panel: {
            kind: "selection",
            draft: props.selected === false ? [null, slots[1], null, null] : slots,
            openerSlot: 0,
            scrollTop: Number(props.scrollTop ?? 0),
            rejection: null,
          },
        }),
  };
  if (panel === "details") {
    snapshot = {
      ...snapshot,
      details: reduceCharacterDetails(snapshot.details, {
        type: "open",
        characterId: String(props.characterId ?? "player"),
        input: { characters, party, context: snapshot.input.detailsContext },
      }).state,
    };
    snapshot = {
      ...snapshot,
      details: {
        ...snapshot.details,
        focus: null,
        scrollTop: Number(props.scrollTop ?? 0),
        ...(snapshot.details.dialog && props.failedPortrait
          ? { dialog: { ...snapshot.details.dialog, portraitFailed: true } }
          : {}),
      },
    };
  }
  return snapshot;
}

export function partyFrame(
  props: Record<string, unknown> = {},
  panel: "formation" | "selection" | "details" = "formation",
) {
  return projectParty(partyModel(props, panel));
}

export function partySlotMember(props: Record<string, unknown> = {}) {
  const slot = partyFrame({ members: 2, ...props }).slots[0];
  if (!slot) throw new Error("Missing first Party story slot");
  return slot.member;
}

export function partyCandidateMember(props: Record<string, unknown> = {}) {
  const member = partyFrame({ members: 2, ...props }, "selection").selection?.candidates[0];
  if (!member) throw new Error("Missing first Party story candidate");
  return member;
}
