import type { Meta, StoryObj } from "@storybook/svelte-vite";
import EquipmentSelect from "../../src/web/components/EquipmentSelect.svelte";
import UtilityStoryHost from "./UtilityStoryHost.svelte";
import { equipmentStoryField } from "./utility-data";

const meta = {
  id: "utility-equipmentselect",
  title: "Components/DS未対応/Items/EquipmentSelect",
  component: EquipmentSelect,
  parameters: { design: { host: { padding: 128, width: 384 } } },
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
export const Default: Story = {};
