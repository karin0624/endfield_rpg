import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubCalendar from "../../src/web/components/HubCalendar.svelte";

const meta = {
  title: "Hub/Calendar",
  component: HubCalendar,
  args: { calendar: "1日目 · 昼" },
  parameters: { design: { host: { className: "hub-theme", width: "max-content" } } },
} satisfies Meta<typeof HubCalendar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Day: Story = { args: { calendar: "1日目 · 昼" } };
export const Night: Story = { args: { calendar: "1日目 · 夜" } };
