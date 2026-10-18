import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, userEvent } from "storybook/test";
import UtilityStoryHost from "../../../../.storybook/fixtures/UtilityStoryHost.svelte";
import { shopStoryFrame } from "../../../../.storybook/fixtures/utility-data";
import ShopDialogPanel from "./ShopDialogPanel.svelte";

const meta = {
  id: "utility-shopdialog",
  title: "Components/DS未対応/Items/ShopDialogPanel",
  component: ShopDialogPanel,
  parameters: {
    design: {
      host: { padding: 128 },
      kind: "component",
      component: "utility/shop-dialog",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".item-dialog", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "dialog" } })],
  args: { frame: shopStoryFrame(), send: fn(() => false) },
} satisfies Meta<typeof ShopDialogPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "utility/shop-dialog/default",
          state: "default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Item Shop / Local Components — DS未対応",
              "Item Shop Dialog",
              "state=default",
            ],
            properties: { offer: "HP回復品 · HP8回復 · 価格10", summary: "所持金 30 · 探索バッグ 0個" },
            nestedProperties: [
              { path: ["Quantity field", "quantity"], properties: { value: "1" } },
              { path: ["Actions", "buy"], properties: { state: "default" } },
            ],
          },
        },
      ],
    },
  },
};

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
