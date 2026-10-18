import type { Meta, StoryObj } from "@storybook/svelte-vite";
import CarryInput from "../../src/web/components/CarryInput.svelte";
import UtilityStoryHost from "./UtilityStoryHost.svelte";

const meta = {
  id: "utility-carryinput",
  title: "Components/DS未対応/Items/CarryInput",
  component: CarryInput,
  parameters: { design: { host: { padding: 128 } } },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "carry" } })],
  args: { value: 0, min: 0, max: 3, step: 1, required: true, "aria-label": "HP回復品の持込み個数" },
} satisfies Meta<typeof CarryInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
