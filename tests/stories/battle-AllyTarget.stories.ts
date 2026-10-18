import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn, userEvent } from "storybook/test";
import BattleAllyTarget from "../../src/web/components/BattleAllyTarget.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-allytarget",
  title: "Components/DS未対応/Battle/AllyTarget",
  component: BattleAllyTarget,
  parameters: { design: { host: { padding: 128, width: 320.625 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { value: "player", options: battleStoryFrame({}, "skills").skills.allies, dispatch },
} satisfies Meta<typeof BattleAllyTarget>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

export const ChangeTarget: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.selectOptions(canvas.getByRole("combobox"), "gilberta");
    await expect(args.dispatch).toHaveBeenCalledWith({ type: "select-ally", id: "gilberta" });
  },
};
