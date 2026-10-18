import type { Meta, StoryObj } from "@storybook/svelte-vite";
import UiButton from "../../src/web/components/UiButton.svelte";

const meta = {
  title: "Legacy/UiButton",
  component: UiButton,
  parameters: { design: { host: { className: "ui-screen formation-theme", width: "max-content" } } },
} satisfies Meta<typeof UiButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { kind: "default", label: "操作", style: "width:120px;height:44px" } };
export const DefaultDisabled: Story = {
  args: { kind: "default", label: "操作", style: "width:120px;height:44px", disabled: true },
};
export const Back: Story = { args: { kind: "back", label: "戻る", style: "width:160px;height:48px" } };
export const BackDisabled: Story = {
  args: { kind: "back", label: "戻る", style: "width:160px;height:48px", disabled: true },
};
export const Primary: Story = { args: { kind: "primary", label: "決定", style: "width:280px;height:64px" } };
export const PrimaryDisabled: Story = {
  args: { kind: "primary", label: "決定", style: "width:280px;height:64px", disabled: true },
};
export const DetailsBack: Story = { args: { kind: "back", label: "編成へ戻る", "data-details-back": true } };
