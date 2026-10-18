import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, within } from "storybook/test";
import Party from "../../src/web/components/Party.svelte";
import PartyInteraction from "./party-interaction.svelte";
import { partyFrame } from "./party-model";

const meta = {
  title: "Integration/Party",
  component: Party,
  args: { frame: partyFrame({ members: 2, edit: true }), send: fn(() => false) },
  parameters: { design: { host: { padding: 0 } } },
  render: (args) => ({ Component: PartyInteraction, props: args }),
} satisfies Meta<typeof Party>;
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
