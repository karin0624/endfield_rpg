import { tick } from "svelte";
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
import { createPartyView } from "../../src/web/partyView.svelte.ts";
import type { DesignCase } from "./design-view";

/** Source views receive fixed public display inputs; pointer states never advance the game. */
async function paint(root: HTMLElement, props: Record<string, unknown>, panel: "formation" | "selection" | "details") {
  root.className = "party-editor";
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
  const view = createPartyView(root, () => false);
  if (panel === "details") {
    // Native modal stacking follows real play: selection opens before its details dialog.
    view.render(projectParty({ ...snapshot, details: { ...snapshot.details, dialog: null, focus: null } }));
    await tick();
  }
  view.render(projectParty(snapshot));
  await tick();
  if (typeof props.isolate === "string") {
    const target = root.querySelector<HTMLElement>(props.isolate);
    if (!target) throw new Error(`Party design part not found: ${props.isolate}`);
    root.style.background = "transparent";
    for (let owner = target.parentElement; owner && root.contains(owner); owner = owner.parentElement) {
      owner.dataset.designIsolationAncestor = "";
      owner.style.background = "transparent";
      owner.style.borderColor = "transparent";
      owner.style.boxShadow = "none";
      owner.style.backdropFilter = "none";
    }
    for (const element of root.querySelectorAll<HTMLElement>("*")) {
      if (element === target || target.contains(element) || element.contains(target)) continue;
      element.style.visibility = "hidden";
    }
    const style = document.createElement("style");
    style.textContent =
      "[data-design-isolation-ancestor]::before,[data-design-isolation-ancestor]::after{visibility:hidden} dialog::backdrop{background:transparent!important;backdrop-filter:none!important}";
    root.append(style);
  }
}

export const cases: Record<string, DesignCase> = {
  screen: (root, props) => paint(root, props, "formation"),
  selection: (root, props) => paint(root, props, "selection"),
  details: (root, props) => paint(root, props, "details"),
  "ui-button"(root, props) {
    root.className = "ui-screen";
    root.style.padding = "32px";
    const button = document.createElement("button");
    button.className = `ui-button${props.kind === "primary" ? " ui-primary" : props.kind === "back" ? " ui-back" : ""}`;
    button.textContent = String(props.label ?? "操作");
    button.disabled = props.disabled === true;
    if (typeof props.width === "number") button.style.width = `${props.width}px`;
    if (typeof props.height === "number") button.style.height = `${props.height}px`;
    root.append(button);
  },
};
