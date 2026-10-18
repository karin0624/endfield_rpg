import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { fn } from "storybook/test";
import BattleSkillPanel from "../../src/web/components/BattleSkillPanel.svelte";
import BattleStoryHost from "./BattleStoryHost.svelte";
import { battleStoryFrame } from "./battle-data";

const dispatch = fn(() => false);
const meta = {
  id: "battle-skillpanel",
  title: "Components/DS未対応/Battle/SkillPanel",
  component: BattleSkillPanel,
  parameters: { design: { host: { padding: 128, width: 320.625 } } },
  decorators: [() => ({ Component: BattleStoryHost, props: { arrangement: "flow" } })],
  args: { skills: battleStoryFrame({}, "skills").skills, dispatch },
} satisfies Meta<typeof BattleSkillPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
