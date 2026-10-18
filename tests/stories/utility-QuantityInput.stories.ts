import type { Meta, StoryObj } from "@storybook/svelte-vite";
import QuantityInput from "../../src/web/components/QuantityInput.svelte";
import UtilityStoryHost from "./UtilityStoryHost.svelte";

const meta = {
  id: "utility-quantityinput",
  title: "Components/DS未対応/Items/QuantityInput",
  component: QuantityInput,
  parameters: { design: { host: { padding: 128, width: 430 } } },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "quantity" } })],
  args: { value: 1, min: 1, step: 1, "data-shop-quantity": "" },
} satisfies Meta<typeof QuantityInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
