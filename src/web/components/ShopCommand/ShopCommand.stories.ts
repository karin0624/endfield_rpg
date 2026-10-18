import type { Meta, StoryObj } from "@storybook/svelte-vite";
import UtilityStoryHost from "../../../../.storybook/fixtures/UtilityStoryHost.svelte";
import ShopCommand from "./ShopCommand.svelte";

const meta = {
  id: "utility-shopcommand",
  title: "Components/DS未対応/Items/ShopCommand",
  component: ShopCommand,
  parameters: {
    design: {
      host: { padding: 128, width: 430 },
      kind: "component",
      component: "items/shop-command",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: "[data-shop-buy]", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "command" } })],
  args: { label: "購入する", "data-shop-buy": "" },
} satisfies Meta<typeof ShopCommand>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "items/shop-command/default",
          state: "default",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Command",
              "state=default",
            ],
            properties: { label: "購入する", focusVisible: false },
          },
        },
        {
          id: "items/shop-command/hover",
          state: "hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Command",
              "state=hover",
            ],
            properties: { label: "購入する", focusVisible: false },
          },
          interaction: [{ type: "hover", selector: "[data-shop-buy]" }],
        },
        {
          id: "items/shop-command/focus",
          state: "focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Command",
              "state=default",
            ],
            properties: { label: "購入する", focusVisible: true },
          },
          interaction: [{ type: "focus", selector: "[data-shop-buy]" }],
        },
        {
          id: "items/shop-command/focus-hover",
          state: "focus-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Command",
              "state=hover",
            ],
            properties: { label: "購入する", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: "[data-shop-buy]" },
            { type: "hover", selector: "[data-shop-buy]" },
          ],
        },
        {
          id: "items/shop-command/focus-pressed",
          state: "focus-pressed",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Command",
              "state=pressed",
            ],
            properties: { label: "購入する", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: "[data-shop-buy]" },
            { type: "pressed", selector: "[data-shop-buy]", method: "keyboard" },
          ],
        },
      ],
    },
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    design: {
      targets: [
        {
          id: "items/shop-command/disabled",
          state: "disabled",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Command",
              "state=disabled",
            ],
            properties: { label: "購入する", focusVisible: false },
          },
        },
      ],
    },
  },
};
