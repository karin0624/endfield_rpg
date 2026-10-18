import type { Meta, StoryObj } from "@storybook/svelte-vite";
import UtilityStoryHost from "../../../../.storybook/fixtures/UtilityStoryHost.svelte";
import CarryInput from "./CarryInput.svelte";

const meta = {
  id: "utility-carryinput",
  title: "Components/DS未対応/Items/CarryInput",
  component: CarryInput,
  parameters: {
    design: {
      host: { padding: 128 },
      kind: "component",
      component: "preparation/carry-input",
      viewport: { width: 1920, height: 1080 },
    },
  },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "carry" } })],
  args: { value: 0, min: 0, max: 3, step: 1, required: true, "aria-label": "HP回復品の持込み個数" },
} satisfies Meta<typeof CarryInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "preparation/carry-input/default",
          state: "default",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=default, focusVisible=false",
            ],
            properties: { value: "0", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent" },
        },
        {
          id: "preparation/carry-input/hover",
          state: "hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=hover, focusVisible=false",
            ],
            properties: { value: "0", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent" },
          interaction: [{ type: "hover", selector: ".item-carry-input" }],
        },
        {
          id: "preparation/carry-input/focus",
          state: "focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=default, focusVisible=true",
            ],
            properties: { value: "0", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "focus", selector: ".item-carry-input" },
            { type: "key", key: "ArrowRight", selector: ".item-carry-input" },
          ],
        },
        {
          id: "preparation/carry-input/focus-selected",
          state: "focus-selected",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=default, focusVisible=true",
            ],
            properties: { value: "0", focusVisible: "true", selectionVisible: true, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "focus", selector: ".item-carry-input" },
            { type: "key", key: "ControlOrMeta+A", selector: ".item-carry-input" },
          ],
        },
        {
          id: "preparation/carry-input/spinner-up-hover",
          state: "spinner-up-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=spinner-up-hover, focusVisible=false",
            ],
            properties: { value: "0", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "hover", selector: ".item-carry-input" },
            { type: "hover", selector: ".item-carry-input", position: { x: 79.5, y: 15.3984375 } },
          ],
        },
        {
          id: "preparation/carry-input/spinner-up-pressed",
          state: "spinner-up-pressed",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=spinner-up-pressed, focusVisible=true",
            ],
            properties: { value: "1", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "hover", selector: ".item-carry-input" },
            {
              type: "pressed",
              selector: ".item-carry-input",
              position: { x: 79.5, y: 15.3984375 },
              expectedValue: "1",
            },
          ],
        },
        {
          id: "preparation/carry-input/spinner-up-focus-hover",
          state: "spinner-up-focus-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=spinner-up-hover, focusVisible=true",
            ],
            properties: { value: "0", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "focus", selector: ".item-carry-input" },
            { type: "key", key: "ArrowRight", selector: ".item-carry-input" },
            { type: "hover", selector: ".item-carry-input" },
            { type: "hover", selector: ".item-carry-input", position: { x: 79.5, y: 15.3984375 } },
          ],
        },
        {
          id: "preparation/carry-input/spinner-down-hover",
          state: "spinner-down-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=spinner-down-hover, focusVisible=false",
            ],
            properties: { value: "0", focusVisible: "false", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "hover", selector: ".item-carry-input" },
            { type: "hover", selector: ".item-carry-input", position: { x: 79.5, y: 28.1953125 } },
          ],
        },
        {
          id: "preparation/carry-input/spinner-down-pressed",
          state: "spinner-down-pressed",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=spinner-down-pressed, focusVisible=true",
            ],
            properties: { value: "0", focusVisible: "true", selectionVisible: true, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent" },
          interaction: [
            { type: "hover", selector: ".item-carry-input" },
            {
              type: "pressed",
              selector: ".item-carry-input",
              position: { x: 79.5, y: 28.1953125 },
              expectedValue: "0",
            },
          ],
        },
        {
          id: "preparation/carry-input/spinner-down-focus-hover",
          state: "spinner-down-focus-hover",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Carry Number Input",
              "state=spinner-down-hover, focusVisible=true",
            ],
            properties: { value: "0", focusVisible: "true", selectionVisible: false, caretVisible: false },
          },
          capture: { selector: ".item-carry-control", padding: 16, background: "transparent", animations: "allow" },
          interaction: [
            { type: "focus", selector: ".item-carry-input" },
            { type: "key", key: "ArrowRight", selector: ".item-carry-input" },
            { type: "hover", selector: ".item-carry-input" },
            { type: "hover", selector: ".item-carry-input", position: { x: 79.5, y: 28.1953125 } },
          ],
        },
      ],
    },
  },
};
