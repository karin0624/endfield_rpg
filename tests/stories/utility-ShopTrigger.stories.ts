import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import ShopTrigger from "../../src/web/components/ShopTrigger.svelte";
import UtilityStoryHost from "./UtilityStoryHost.svelte";

const meta = {
  id: "utility-shoptrigger",
  title: "Components/DS未対応/Items/ShopTrigger",
  component: ShopTrigger,
  parameters: { design: { host: { padding: 16, width: 1888 } } },
  decorators: [() => ({ Component: UtilityStoryHost, props: { kind: "trigger" } })],
  args: { visible: true, onclick: fn() },
} satisfies Meta<typeof ShopTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
