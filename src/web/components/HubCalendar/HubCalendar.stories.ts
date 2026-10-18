import type { Meta, StoryObj } from "@storybook/svelte-vite";
import HubCalendar from "./HubCalendar.svelte";

const meta = {
  title: "Hub/Calendar",
  component: HubCalendar,
  args: { calendar: "1日目 · 昼" },
  parameters: {
    design: {
      host: { className: "hub-theme", width: "max-content" },
      kind: "component",
      component: "hub/calendar",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".progress-clock", padding: 24, background: "#192327" },
    },
  },
} satisfies Meta<typeof HubCalendar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Day: Story = {
  args: { calendar: "1日目 · 昼" },
  parameters: {
    design: {
      targets: [
        {
          id: "hub/calendar/day/1",
          state: "day/1",
          figma: { path: ["Components / Hub", "Hub/HubCalendar", "period=day"], properties: { day: "1" } },
        },
      ],
    },
  },
};
export const Night: Story = {
  args: { calendar: "1日目 · 夜" },
  parameters: {
    design: {
      targets: [
        {
          id: "hub/calendar/night/1",
          state: "night/1",
          figma: { path: ["Components / Hub", "Hub/HubCalendar", "period=night"], properties: { day: "1" } },
        },
      ],
    },
  },
};
