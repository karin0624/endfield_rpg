import type { Meta, StoryObj } from "@storybook/svelte-vite";
import UtilityStoryHost from "../../../../.storybook/fixtures/UtilityStoryHost.svelte";
import QuantityInput from "./QuantityInput.svelte";

const meta = {
  id: "utility-quantityinput",
  title: "Components/DS未対応/Items/QuantityInput",
  component: QuantityInput,
  parameters: {
    design: {
      host: { padding: 128, width: 430 },
      kind: "component",
      component: "items/number-input",
      viewport: { width: 1920, height: 1080 },
    },
  },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "quantity" } })],
  args: { value: 1, min: 1, step: 1, "data-shop-quantity": "" },
} satisfies Meta<typeof QuantityInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "items/number-input/default",
          state: "default",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=default, focusVisible=false",
            ],
            properties: { value: "1", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent" },
        },
        {
          id: "items/number-input/hover",
          state: "hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=hover, focusVisible=false",
            ],
            properties: { value: "1", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent" },
          interaction: [{ type: "hover", selector: "[data-shop-quantity]" }],
        },
        {
          id: "items/number-input/focus",
          state: "focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=default, focusVisible=true",
            ],
            properties: { value: "1", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "focus", selector: "[data-shop-quantity]" },
            { type: "key", key: "ArrowRight", selector: "[data-shop-quantity]" },
          ],
        },
        {
          id: "items/number-input/focus-selected",
          state: "focus-selected",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=default, focusVisible=true",
            ],
            properties: { value: "1", focusVisible: "true", selectionVisible: true, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "focus", selector: "[data-shop-quantity]" },
            { type: "key", key: "ControlOrMeta+A", selector: "[data-shop-quantity]" },
          ],
        },
        {
          id: "items/number-input/spinner-up-hover",
          state: "spinner-up-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=spinner-up-hover, focusVisible=false",
            ],
            properties: { value: "1", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "hover", selector: "[data-shop-quantity]" },
            { type: "hover", selector: "[data-shop-quantity]", position: { x: 411.90625, y: 16.9921875 } },
          ],
        },
        {
          id: "items/number-input/spinner-up-pressed",
          state: "spinner-up-pressed",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=spinner-up-pressed, focusVisible=true",
            ],
            properties: { value: "2", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "hover", selector: "[data-shop-quantity]" },
            {
              type: "pressed",
              selector: "[data-shop-quantity]",
              position: { x: 411.90625, y: 16.9921875 },
              expectedValue: "2",
            },
          ],
        },
        {
          id: "items/number-input/spinner-up-focus-hover",
          state: "spinner-up-focus-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=spinner-up-hover, focusVisible=true",
            ],
            properties: { value: "1", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "focus", selector: "[data-shop-quantity]" },
            { type: "key", key: "ArrowRight", selector: "[data-shop-quantity]" },
            { type: "hover", selector: "[data-shop-quantity]" },
            { type: "hover", selector: "[data-shop-quantity]", position: { x: 411.90625, y: 16.9921875 } },
          ],
        },
        {
          id: "items/number-input/spinner-down-hover",
          state: "spinner-down-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=spinner-down-hover, focusVisible=false",
            ],
            properties: { value: "1", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "hover", selector: "[data-shop-quantity]" },
            { type: "hover", selector: "[data-shop-quantity]", position: { x: 411.90625, y: 29.7890625 } },
          ],
        },
        {
          id: "items/number-input/spinner-down-pressed",
          state: "spinner-down-pressed",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=spinner-down-pressed, focusVisible=true",
            ],
            properties: { value: "1", focusVisible: "true", selectionVisible: true, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "hover", selector: "[data-shop-quantity]" },
            {
              type: "pressed",
              selector: "[data-shop-quantity]",
              position: { x: 411.90625, y: 29.7890625 },
              expectedValue: "1",
            },
          ],
        },
        {
          id: "items/number-input/spinner-down-focus-hover",
          state: "spinner-down-focus-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Item Number Input",
              "state=spinner-down-hover, focusVisible=true",
            ],
            properties: { value: "1", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-number-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "focus", selector: "[data-shop-quantity]" },
            { type: "key", key: "ArrowRight", selector: "[data-shop-quantity]" },
            { type: "hover", selector: "[data-shop-quantity]" },
            { type: "hover", selector: "[data-shop-quantity]", position: { x: 411.90625, y: 29.7890625 } },
          ],
        },
      ],
    },
  },
};
