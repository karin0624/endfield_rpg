import { equipmentCatalog } from "../content/equipmentDefinitions";
import { itemCatalog, recoveryItemId, recoveryItemOffer } from "../content/itemSettings";
import { editHomeEquipment } from "../game/equipmentRuntime";
import { createInventory } from "../game/inventory";
import { purchaseItem } from "../game/itemPurchase";
import { bagItemQuantity } from "../game/items";
import "./items.css";
import { characters } from "../content/characters";
import { growthRules } from "../content/growthRules";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { mentalFatigueDefinition } from "../content/mentalFatigueDefinition";
import { saveDefinitions } from "../content/saveDefinitions";
import { skillCatalog } from "../content/skillDefinitions";
import { createInitialGameState } from "../game/createInitialGameState";
import {
  actInExpedition,
  actInTown,
  beginTownExploration,
  confirmExpeditionParty,
  departOnExpedition,
  type ExpeditionGame,
  type GameActionCompletion,
  leaveExpedition,
} from "../game/expedition";
import { chooseGrowthSkill, grownCharacters, hasPendingGrowth } from "../game/growthRuntime";
import { characterById, createParty, getPartyCombatants } from "../game/party";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import { mountAdventureUi } from "./adventureUi";
import { characterPortraitUrl } from "./characterPortrait";
import { mountDungeonUi } from "./dungeonUi";
import { mountGrowthChoice } from "./growthChoiceUi";
import { mountPartyUi } from "./partyUi";
import { requiredElement } from "./requiredElement";
import { loadSlot, writeSlot } from "./saveSlot";
import { calendarLabel, completionFeedback, mentalFatigueText, symptomLabel } from "./sessionFeedback";
import "./campaign.css";

// Development labels are omitted without changing skill IDs or effects.
const catalog = {
  ...skillCatalog,
  skills: skillCatalog.skills.map((skill) => ({ ...skill, name: skill.name.replace(/^検証用/, "") })),
};
const rules = { catalog, fatigue: mentalFatigueDefinition, growth: growthRules };
function newGame(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
    inventory: createInventory(),
  };
}

export function mountCampaign(root: HTMLDivElement): () => void {
  let game = newGame();
  let carryQuantity = 0;
  const itemSelection = () => (carryQuantity > 0 ? [{ itemId: recoveryItemId, quantity: carryQuantity }] : []);
  let completion: GameActionCompletion | undefined;
  let disposeView: (() => void) | undefined;
  let viewEvents = new AbortController();
  const events = new AbortController();
  let disposed = false;
  // Do not let the second click activate a newly revealed screen.
  root.addEventListener(
    "click",
    (event) => {
      // Candidate toggles stay on this screen and must receive every click.
      if (event.target instanceof Element && event.target.closest(".party-candidate")) return;
      if (event.detail > 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, signal: events.signal },
  );
  function clear() {
    disposeView?.();
    disposeView = undefined;
    viewEvents.abort();
    viewEvents = new AbortController();
    document.body.classList.remove("dungeon-mode");
  }
  function button(label: string, action: () => void, primary = false): HTMLButtonElement {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.className = primary ? "campaign-command is-primary" : "campaign-command";
    element.addEventListener(
      "click",
      () => {
        if (!disposed) action();
      },
      { signal: viewEvents.signal },
    );
    return element;
  }
  function screen(title: string, mode: string, message = "") {
    clear();
    root.innerHTML = `<main class="campaign-screen" data-campaign-screen="${mode}">
      <div class="campaign-art" aria-hidden="true"></div>
      <header class="campaign-header"><h1 tabindex="-1"></h1><p data-calendar></p></header>
      <section class="campaign-content"><div class="campaign-copy"></div><nav class="campaign-commands" aria-label="${title}"></nav>
      <p class="campaign-status" role="status"></p></section></main>`;
    requiredElement<HTMLElement>(root, "h1").textContent = title;
    requiredElement<HTMLElement>(root, "[data-calendar]").textContent =
      mode === "title" || mode === "intro" ? "" : calendarLabel(game.clock);
    requiredElement<HTMLElement>(root, "[role=status]").textContent = message;
    requiredElement<HTMLElement>(root, "h1").focus();
    return requiredElement<HTMLElement>(root, ".campaign-commands");
  }
  function copy(text: string) {
    const p = document.createElement("p");
    p.textContent = text;
    requiredElement<HTMLElement>(root, ".campaign-copy").append(p);
  }
  function confirm(title: string, message: string, accept: () => void, cancel: () => void) {
    const nav = screen(title, "confirm");
    copy(message);
    nav.append(button("取り消す", cancel), button("実行する", accept, true));
    requiredElement<HTMLButtonElement>(nav, "button").focus();
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") cancel();
      },
      { signal: viewEvents.signal },
    );
  }
  function showTitle(message = "") {
    completion = undefined;
    const nav = screen("ENDFIELD RPG", "title", message);
    nav.append(
      button(
        "新規開始",
        () =>
          confirm(
            "新しく始めますか",
            "新しいプレイを始めます。既存の保存データは、ホームで保存するまで保持されます。",
            () => {
              game = newGame();
              carryQuantity = 0;
              completion = undefined;
              showIntro();
            },
            () => showTitle(),
          ),
        true,
      ),
      button("続きから", () => {
        const result = loadSlot(newGame(), saveDefinitions);
        if (result.state) {
          game = result.state;
          carryQuantity = 0;
          showHome(result.message);
        } else showTitle(result.message);
      }),
    );
  }
  function showIntro() {
    const nav = screen("導入", "intro");
    copy("（仮テキスト）");
    nav.append(
      button("ホームへ", () => showHome(), true),
      button("タイトルへ戻る", () => showTitle()),
    );
  }
  function feedback() {
    return [
      ...completionFeedback(completion, characters),
      ...(completion?.lostItems?.length
        ? [`物品ロスト：${completion.lostItems.reduce((n, item) => n + item.quantity, 0)}個`]
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
  function save(returnToTitle: boolean) {
    confirm(
      "保存しますか",
      "同じブラウザの保存スロットを上書きします。",
      () => {
        const result = writeSlot(game, saveDefinitions);
        if (result.saved && returnToTitle) showTitle(result.message);
        else showHome(result.message);
      },
      () => showHome(),
    );
  }
  function showHome(message = "") {
    const nav = screen("ホーム", "home", message);
    const art = requiredElement<HTMLElement>(root, ".campaign-art");
    const portrait = document.createElement("img");
    portrait.src = characterPortraitUrl(game.party.slots.find((id) => id !== null) ?? "player") ?? "";
    portrait.alt = "";
    art.append(portrait);
    const report = document.createElement("div");
    report.dataset.townRecovery = "";
    report.className = "campaign-report";
    report.setAttribute("role", "status");
    for (const text of feedback()) {
      const p = document.createElement("p");
      p.textContent = text;
      report.append(p);
    }
    report.hidden = report.childElementCount === 0;
    requiredElement<HTMLElement>(root, ".campaign-copy").append(report);
    const stock = game.inventory?.items.home.find((s) => s.itemId === recoveryItemId)?.quantity ?? 0;
    carryQuantity = Math.min(carryQuantity, stock);
    copy(`所持金 ${game.inventory?.balance ?? 0} · ホーム保管 HP回復品 ${stock}個`);
    const carryLabel = document.createElement("label");
    carryLabel.textContent = "持込み個数（HP回復品）";
    const carry = document.createElement("input");
    carry.type = "number";
    carry.min = "0";
    carry.max = String(stock);
    carry.step = "1";
    carry.value = String(carryQuantity);
    carry.className = "item-carry-input";
    carry.addEventListener(
      "input",
      () => {
        carryQuantity =
          Number.isSafeInteger(carry.valueAsNumber) && carry.valueAsNumber >= 0 && carry.valueAsNumber <= stock
            ? carry.valueAsNumber
            : 0;
      },
      { signal: viewEvents.signal },
    );
    carryLabel.append(carry);
    requiredElement<HTMLElement>(root, ".campaign-copy").append(carryLabel);
    nav.append(
      button(
        "探索先を選ぶ",
        () => {
          if (carry.reportValidity()) showDestinations();
        },
        true,
      ),
      button("出撃編成を見る", () => showParty("edit")),
      button("装備を整える", showEquipment),
    );
    nav.append(
      button("保存", () => save(false)),
      button("保存してタイトルへ戻る", () => save(true)),
      button("タイトルへ戻る", () =>
        confirm(
          "タイトルへ戻りますか",
          "保存していない変更は失われます。既存の保存データは保持されます。",
          () => showTitle(),
          () => showHome(),
        ),
      ),
    );
  }
  function showEquipment(message = "") {
    const nav = screen("装備", "equipment", message);
    const inventory = game.inventory;
    if (!inventory) return;
    for (const member of game.party.members) {
      const name = characterById(characters, member.id).name;
      const stats =
        grownCharacters(game, rules).find((c) => c.id === member.id) ?? characterById(characters, member.id);
      copy(
        `${name} · HP ${member.hp}/${effectiveMaxHp(stats.maxHp, member.status ?? healthyStatus())} · 攻撃力 ${stats.attackPower}`,
      );
      for (const slot of ["weapon", "armor"] as const) {
        const label = document.createElement("label");
        label.textContent = `${name}の${slot === "weapon" ? "武器（攻撃力+1）" : "防具（最大HP+4）"}`;
        const select = document.createElement("select");
        select.className = "item-equipment-select";
        const none = document.createElement("option");
        none.value = "";
        none.textContent = "装備なし";
        select.append(none);
        let number = 0;
        for (const instance of inventory.equipment.owned) {
          if (!equipmentCatalog.some((e) => e.id === instance.definitionId && e.slot === slot)) continue;
          number++;
          const owner = inventory.equipment.assignments.find(
            (a) => a.weapon === instance.instanceId || a.armor === instance.instanceId,
          );
          const option = document.createElement("option");
          option.value = instance.instanceId;
          option.textContent = `${slot === "weapon" ? "武器" : "防具"} ${number}${owner ? ` · ${characterById(characters, owner.characterId).name}` : ""}`;
          option.disabled = owner !== undefined && owner.characterId !== member.id;
          select.append(option);
        }
        select.value = inventory.equipment.assignments.find((a) => a.characterId === member.id)?.[slot] ?? "";
        select.addEventListener(
          "change",
          () => {
            const result = editHomeEquipment(game, "home", member.id, slot, select.value || null, characters, rules);
            game = result.state;
            showEquipment(result.accepted ? "装備を変更しました。" : "装備を変更できませんでした。");
          },
          { signal: viewEvents.signal },
        );
        label.append(select);
        requiredElement<HTMLElement>(root, ".campaign-copy").append(label);
      }
    }
    if (!inventory.equipment.owned.length) copy("所持している装備はありません。");
    nav.append(button("ホームへ戻る", () => showHome()));
  }
  function showDestinations(message = "") {
    const nav = screen("探索先選択", "destinations", message);
    copy("街探索とダンジョンは、完了時にそれぞれ半日が経過します。");
    nav.append(
      button("街", showTown),
      button("ダンジョン", () => showParty("departure")),
      button("ホームへ戻る", () => showHome()),
    );
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && !event.repeat && !event.defaultPrevented) showHome();
      },
      { signal: viewEvents.signal },
    );
  }
  function showParty(context: "edit" | "departure") {
    screen(context === "departure" ? "出発準備" : "編成", "party");
    const panel = document.createElement("section");
    panel.className = "party-editor";
    requiredElement<HTMLElement>(root, ".campaign-content").replaceChildren(panel);
    disposeView = mountPartyUi(
      panel,
      {
        context,
        characters: grownCharacters(game, rules),
        getDetailsContext: () => ({
          characters: grownCharacters(game, rules),
          baseCharacters: characters,
          growth: game.growth,
          rules,
        }),
        getParty: () => game.party,
        getCalendarLabel: () => calendarLabel(game.clock),
        confirm: (slots) => {
          const result = confirmExpeditionParty(game, slots);
          game = result.state;
          return result;
        },
        depart: () => {
          const result = departOnExpedition(game, characters, initialDungeon, initialAdventure, rules, itemSelection());
          if (result.accepted) {
            game = result.state;
            carryQuantity = 0;
            completion = undefined;
            showDungeon();
          }
          return result;
        },
      },
      () => {
        if (context === "departure") showDestinations();
        else showHome();
        root.querySelectorAll<HTMLButtonElement>(".campaign-command")[1]?.focus();
      },
    ).dispose;
    requiredElement<HTMLElement>(panel, "[data-party-back]").focus();
  }
  function showTown() {
    clear();
    if (hasPendingGrowth(game) && game.growth) {
      disposeView = mountGrowthChoice(
        root,
        game.growth,
        catalog,
        Object.fromEntries(characters.map(({ id, name }) => [id, name])),
        (input) => {
          game = chooseGrowthSkill(game, input, rules).state;
          showTown();
        },
      );
      return;
    }
    disposeView = mountAdventureUi(root, undefined, {
      initialState: game.adventure,
      shop: {
        balance: () => game.inventory?.balance ?? 0,
        count: () => (game.inventory ? bagItemQuantity(game.inventory.items, recoveryItemId) : 0),
        buy: (quantity) => {
          const inventory = game.inventory;
          const action = game.clock?.pendingAction;
          if (
            !inventory ||
            action?.kind !== "town-exploration" ||
            game.adventure.currentPlaceId !== "market" ||
            game.adventure.mode !== "conversation"
          )
            return false;
          const bought = purchaseItem(
            inventory.items,
            inventory.balance,
            recoveryItemOffer,
            {
              quantity,
              explorationId: action.id,
              expectedVersion: inventory.items.version,
              transactionId: String(inventory.items.version),
            },
            itemCatalog,
          );
          if (!bought.accepted) return false;
          game = { ...game, inventory: { ...inventory, items: bought.items, balance: bought.balance } };
          return true;
        },
      },
      getCalendarLabel: () => calendarLabel(game.clock),
      getFeedback: feedback,
      onHome: () => showHome(),
      dispatch: (command, actionId) => {
        const result =
          command.type === "select"
            ? beginTownExploration(game, command.placeId, initialAdventure, itemSelection())
            : actInTown(game, actionId ?? -1, command, characters, initialAdventure, mentalFatigueDefinition, rules);
        game = result.state;
        if (result.accepted && command.type === "select") carryQuantity = 0;
        if (result.accepted) completion = result.completion;
        if (hasPendingGrowth(game))
          queueMicrotask(() => {
            if (!disposed) showTown();
          });
        return result.accepted
          ? {
              accepted: true,
              state: game.adventure,
              actionId: game.clock?.pendingAction?.id,
              recruitedNames: result.completion?.recruitedIds?.map((id) => characterById(characters, id).name),
            }
          : { accepted: false, state: game.adventure, reason: "conversation-progress-invalid" };
      },
    }).dispose;
    root.querySelector<HTMLElement>(".town-place")?.focus();
  }
  function showDungeon() {
    clear();
    if (game.dungeon === null) return;
    document.body.classList.add("dungeon-mode");
    const actionId = game.clock?.pendingAction?.id;
    disposeView = mountDungeonUi(root, {
      initialState: game.dungeon,
      getItems: () => game.inventory?.items,
      getGrowth: () => game.growth,
      chooseGrowth: (input) => {
        game = chooseGrowthSkill(game, input, rules).state;
        return game.dungeon ?? undefined;
      },
      skillRules: rules,
      calendarLabel: calendarLabel(game.clock),
      combatants: getPartyCombatants(game.party, characters).map((member) => ({
        ...member,
        hp: effectiveMaxHp(characterById(characters, member.id).maxHp, member.status ?? healthyStatus()),
      })),
      displayNames: Object.fromEntries(characters.map(({ id, name }) => [id, name])),
      dispatch: (command) => {
        const update = actInExpedition(game, command, initialDungeon, initialAdventure, rules);
        game = update.state;
        if (update.completion) completion = update.completion;
        return update.result;
      },
      returnLabel: "ホームへ帰還",
      onReturn: () => {
        if (game.dungeon === null) {
          showHome();
          return;
        }
        const result = leaveExpedition(game, actionId, rules);
        game = result.state;
        if (result.accepted) {
          completion = result.completion;
          showHome();
        }
      },
    });
  }
  showTitle();
  return () => {
    disposed = true;
    clear();
    events.abort();
    viewEvents.abort();
  };
}
