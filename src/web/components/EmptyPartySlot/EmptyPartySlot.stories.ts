import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn } from "storybook/test";
import EmptyPartySlot from "./EmptyPartySlot.svelte";

const meta = {
  title: "Party/EmptySlot",
  component: EmptyPartySlot,
  args: { slot: 2, send: fn(() => false) },
  parameters: {
    design: {
      host: { className: "ui-screen formation-theme", width: 372.046875 },
      kind: "component",
      viewport: { width: 1920, height: 1080 },
      capture: { selector: ".party-slot-choice", padding: 16, background: "transparent" },
    },
  },
} satisfies Meta<typeof EmptyPartySlot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole("button", { name: "枠 3" });
    await expect(button).toHaveAccessibleDescription("空き枠。仲間を選択");
    await userEvent.click(button);
    await expect(args.send).toHaveBeenCalledWith({ type: "focused", target: { kind: "slot", slot: 2 } });
    await expect(args.send).toHaveBeenCalledWith({ type: "open-selection", slot: 2 });
  },
  parameters: {
    design: {
      component: "party/slot/empty",
      targets: [
        {
          id: "party-slot-empty-default",
          figma: { path: ["Components / DS未対応", "Party — DS未対応", "Party slot / empty", "state=default"] },
          state: "party-slot-empty-default",
        },
        {
          id: "party-slot-empty-focus",
          figma: {
            path: ["Components / DS未対応", "Party — DS未対応", "Party slot / empty", "state=default"],
            properties: { focusVisible: true },
          },
          interaction: [{ type: "focus", selector: ".party-slot-choice" }],
          state: "party-slot-empty-focus",
        },
      ],
    },
  },
};
