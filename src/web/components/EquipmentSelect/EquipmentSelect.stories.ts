import type { Meta, StoryObj } from "@storybook/svelte-vite";
import UtilityStoryHost from "../../../../.storybook/fixtures/UtilityStoryHost.svelte";
import { equipmentStoryField } from "../../../../.storybook/fixtures/utility-data";
import EquipmentSelect from "./EquipmentSelect.svelte";

const meta = {
  id: "utility-equipmentselect",
  title: "Components/DS未対応/Items/EquipmentSelect",
  component: EquipmentSelect,
  parameters: {
    design: {
      host: { padding: 128, width: 384 },
      kind: "component",
      component: "items/equipment-select",
      viewport: { width: 1920, height: 1080 },
    },
  },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "equipment" } })],
  args: {
    options: equipmentStoryField().options,
    value: equipmentStoryField().selected,
    "data-character": "player",
    "data-slot": "weapon",
  },
} satisfies Meta<typeof EquipmentSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  parameters: {
    design: {
      targets: [
        {
          id: "items/equipment-select/default",
          state: "default",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Equipment Select",
              "focusVisible=false, menu=closed",
            ],
            properties: { selectedLabel: "装備なし", focusVisible: "false", menu: "closed" },
          },
          capture: { selector: '.item-equipment-select[data-slot="weapon"]', padding: 16, background: "transparent" },
        },
        {
          id: "items/equipment-select/focus",
          state: "focus",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Equipment Select",
              "focusVisible=true, menu=closed",
            ],
            properties: { selectedLabel: "装備なし", focusVisible: "true", menu: "closed" },
          },
          capture: { selector: '.item-equipment-select[data-slot="weapon"]', padding: 16, background: "transparent" },
          interaction: [{ type: "focus", selector: '.item-equipment-select[data-slot="weapon"]' }],
        },
        {
          id: "items/equipment-select/open-keyboard",
          state: "open-keyboard",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Equipment Select",
              "focusVisible=true, menu=open",
            ],
            properties: { selectedLabel: "装備なし", focusVisible: "true", menu: "open" },
          },
          capture: {
            selector: '.item-equipment-select[data-slot="weapon"]',
            padding: { top: 16, right: 16, bottom: 128, left: 16 },
            background: "transparent",
          },
          interaction: [
            { type: "focus", selector: '.item-equipment-select[data-slot="weapon"]' },
            { type: "key", key: "Alt+ArrowDown", selector: '.item-equipment-select[data-slot="weapon"]' },
          ],
        },
        {
          id: "items/equipment-select/open-highlight-next",
          state: "open-highlight-next",
          figma: {
            path: [
              "Components / DS未対応",
              "Items / native form controls — DS未対応",
              "Equipment Select",
              "focusVisible=true, menu=hover-next",
            ],
            properties: { selectedLabel: "武器 1", focusVisible: "true", menu: "hover-next" },
          },
          capture: {
            selector: '.item-equipment-select[data-slot="weapon"]',
            padding: { top: 16, right: 16, bottom: 128, left: 16 },
            background: "transparent",
          },
          interaction: [
            { type: "focus", selector: '.item-equipment-select[data-slot="weapon"]' },
            { type: "key", key: "Alt+ArrowDown", selector: '.item-equipment-select[data-slot="weapon"]' },
            {
              type: "key",
              selector: '.item-equipment-select[data-slot="weapon"]',
              key: "ArrowDown",
              expectedValue: "",
            },
          ],
        },
      ],
    },
  },
};
