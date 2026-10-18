import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, within } from "storybook/test";
import { characters } from "../../../content/characters";
import { growthRules } from "../../../content/growthRules";
import { initialGameOptions } from "../../../content/initialGameOptions";
import { mentalFatigueDefinition } from "../../../content/mentalFatigueDefinition";
import { skillCatalog } from "../../../content/skillDefinitions";
import { createInitialGameState } from "../../../game/createInitialGameState";
import { healthyStatus } from "../../../game/status";
import { createPartyModel, type PartyInput } from "../../../presentation/partyModel";
import PartyInteraction from "./Party.integration.stories.svelte";

const input: PartyInput = {
  game: {
    adventure: createInitialGameState(initialGameOptions),
    party: {
      members: [
        { id: "player", hp: 20, status: healthyStatus(), mentalFatigue: 0 },
        { id: "gilberta", hp: 18, status: healthyStatus(), mentalFatigue: 0 },
      ],
      slots: ["player", "gilberta", null, null],
    },
    dungeon: null,
  },
  characters,
  calendarLabel: "1日目 · 昼",
  detailsContext: {
    characters,
    baseCharacters: characters,
    growth: undefined,
    rules: { catalog: skillCatalog, fatigue: mentalFatigueDefinition, growth: { ...growthRules, characters } },
  },
};

const meta = {
  title: "Integration/Party",
  component: PartyInteraction,
  args: { model: { ...createPartyModel(input, "home"), focus: null }, send: fn(() => false) },
  parameters: { design: { host: { padding: 0 } } },
} satisfies Meta<typeof PartyInteraction>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The production reducer, cards, modal and focus restoration run together. */
export const SelectAndConfirm: Story = {
  play: async ({ canvas, userEvent }) => {
    const opener = canvas.getByRole("button", { name: "枠 1" });
    await userEvent.click(opener);
    const selection = await canvas.findByRole("dialog", { name: "仲間を選択" });
    const candidate = within(selection).getByRole("button", { name: "ロッシ" });
    await expect(candidate).toHaveAttribute("aria-pressed", "true");
    const details = within(selection).getByRole("button", { name: "ロッシの詳細" });
    await userEvent.click(details);
    const information = await canvas.findByRole("dialog", { name: "ロッシ" });
    await userEvent.click(within(information).getByRole("button", { name: "編成へ戻る" }));
    await expect(information).not.toBeVisible();
    await expect(details).toHaveFocus();
    await userEvent.click(candidate);
    await expect(candidate).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(within(selection).getByRole("button", { name: "確定" }));
    await expect(selection).not.toBeVisible();
    await expect(opener).toHaveAccessibleDescription(/^ギルベルタ HP 18\/18\s*$/);
    await expect(canvas.getByRole("button", { name: "枠 2" })).toHaveAccessibleDescription("空き枠。仲間を選択");
    await expect(opener).toHaveFocus();
  },
};
