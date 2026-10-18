import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import UtilityStoryHost from "../../../../.storybook/fixtures/UtilityStoryHost.svelte";
import ShopTrigger from "./ShopTrigger.svelte";

const meta = {
  id: "utility-shoptrigger",
  title: "Components/DS未対応/Items/ShopTrigger",
  component: ShopTrigger,
  parameters: {
    design: {
      host: { padding: 16, width: 1888 },
      kind: "component",
      component: "items/shop-trigger",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".item-shop-trigger", padding: 16, background: "transparent" },
    },
  },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "trigger" } })],
  args: { visible: true, onclick: fn() },
} satisfies Meta<typeof ShopTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "items/shop-trigger/default",
          state: "default",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Trigger",
              "state=default",
            ],
            properties: { label: "買物", focusVisible: false },
          },
        },
        {
          id: "items/shop-trigger/hover",
          state: "hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Trigger",
              "state=hover",
            ],
            properties: { label: "買物", focusVisible: false },
          },
          interaction: [{ type: "hover", selector: ".item-shop-trigger" }],
        },
        {
          id: "items/shop-trigger/focus",
          state: "focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Trigger",
              "state=default",
            ],
            properties: { label: "買物", focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".item-shop-trigger" }],
        },
        {
          id: "items/shop-trigger/focus-hover",
          state: "focus-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Trigger",
              "state=hover",
            ],
            properties: { label: "買物", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".item-shop-trigger" },
            { type: "hover", selector: ".item-shop-trigger" },
          ],
        },
        {
          id: "items/shop-trigger/focus-pressed",
          state: "focus-pressed",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Shop Trigger",
              "state=pressed",
            ],
            properties: { label: "買物", focusVisible: true },
          },
          interaction: [
            { type: "focus", selector: ".item-shop-trigger" },
            { type: "pressed", selector: ".item-shop-trigger", method: "keyboard" },
          ],
        },
      ],
    },
  },
};
