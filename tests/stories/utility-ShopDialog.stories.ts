import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, userEvent } from "storybook/test";
import ShopDialogPanel from "../../src/web/components/ShopDialogPanel.svelte";
import UtilityStoryHost from "./UtilityStoryHost.svelte";
import { shopStoryFrame } from "./utility-data";

const meta = {
  id: "utility-shopdialog",
  title: "Components/DS未対応/Items/ShopDialogPanel",
  component: ShopDialogPanel,
  parameters: { design: { host: { padding: 128 } } },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "dialog" } })],
  args: { frame: shopStoryFrame(), send: fn(() => false) },
} satisfies Meta<typeof ShopDialogPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

export const PurchaseInteraction: Story = {
  play: async ({ canvas, args }) => {
    const quantity = canvas.getByRole("spinbutton");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "2");
    await expect(args.send).toHaveBeenCalledWith({ type: "shop-quantity", quantity: 2 });
    await userEvent.click(canvas.getByRole("button", { name: "購入する" }));
    await expect(args.send).toHaveBeenCalledWith({ type: "shop-buy" });
  },
};
