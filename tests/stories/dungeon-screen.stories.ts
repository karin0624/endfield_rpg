import type { Meta, StoryObj } from "@storybook/svelte-vite";
import Dungeon from "../../src/web/components/Dungeon.svelte";
import DungeonStory from "./DungeonStory.svelte";
import { dungeonFrame } from "./dungeon-data";

const meta = {
  id: "dungeon-screen",
  title: "Screens/DS未対応/Dungeon",
  component: Dungeon,
  parameters: { design: { host: { width: 1920, height: 1080, padding: 0 } } },
  args: { frame: dungeonFrame(), battleStatus: null, send: () => false },
  render: (args) => ({ Component: DungeonStory, props: args }),
} satisfies Meta<typeof Dungeon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Route: Story = {};
export const Conversation: Story = { args: { frame: dungeonFrame({ mode: "conversation" }) } };
export const ConversationChoice: Story = { args: { frame: dungeonFrame({ mode: "conversation", type: "choice" }) } };
export const RecoveryActor: Story = { args: { frame: dungeonFrame({ panel: "actor" }) } };
export const RecoveryActorEmpty: Story = { args: { frame: dungeonFrame({ panel: "actor", empty: "actors" }) } };
export const RecoverySkill: Story = { args: { frame: dungeonFrame({ panel: "skill" }) } };
export const RecoverySkillEmpty: Story = { args: { frame: dungeonFrame({ panel: "skill", empty: "skills" }) } };
export const RecoveryTarget: Story = { args: { frame: dungeonFrame({ panel: "target", injured: true }) } };
export const ItemRecoveryFull: Story = { args: { frame: dungeonFrame({ panel: "item" }) } };
export const OutcomeCleared: Story = { args: { frame: dungeonFrame({ mode: "outcome", outcome: "cleared" }) } };
export const Growth: Story = { args: { frame: dungeonFrame({ mode: "growth" }) } };
export const GrowthGuaranteed: Story = {
  args: { frame: dungeonFrame({ mode: "growth", guaranteed: "習得済みの成長を確認しました。" }) },
};
export const GrowthError: Story = {
  args: { frame: dungeonFrame({ mode: "growth", error: "候補から習得するスキルを選んでください。" }) },
};
export const GrowthGuaranteedAndError: Story = {
  args: {
    frame: dungeonFrame({
      mode: "growth",
      guaranteed: "習得済みの成長を確認しました。",
      error: "候補から習得するスキルを選んでください。",
    }),
  },
};
