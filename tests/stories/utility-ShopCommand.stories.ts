import type { Meta, StoryObj } from "@storybook/svelte-vite";
import ShopCommand from "../../src/web/components/ShopCommand.svelte";
import UtilityStoryHost from "./UtilityStoryHost.svelte";

const meta = {
  id: "utility-shopcommand",
  title: "Components/DS未対応/Items/ShopCommand",
  component: ShopCommand,
  parameters: { design: { host: { padding: 128, width: 430 } } },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "command" } })],
  args: { label: "購入する", "data-shop-buy": "" },
} satisfies Meta<typeof ShopCommand>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
