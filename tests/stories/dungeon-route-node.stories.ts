import type { Meta, StoryObj } from "@storybook/svelte-vite";
import DungeonRouteNode from "../../src/web/components/DungeonRouteNode.svelte";
import { routeNode } from "./dungeon-data";

const meta = {
  id: "dungeon-route-node",
  title: "DS未対応/Dungeon/RouteNode",
  component: DungeonRouteNode,
  parameters: { design: { host: { width: 210, padding: 160 } } },
  args: { node: routeNode("battle", "available"), enter: () => {}, focused: () => {} },
} satisfies Meta<typeof DungeonRouteNode>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BattleAvailable: Story = { args: { node: routeNode("battle", "available") } };
export const BattleCurrent: Story = { args: { node: routeNode("battle", "current") } };
export const BattleUnreachable: Story = { args: { node: routeNode("battle", "unreachable") } };
export const BattlePast: Story = { args: { node: routeNode("battle", "past") } };
export const ConversationAvailable: Story = { args: { node: routeNode("conversation", "available") } };
export const ConversationCurrent: Story = { args: { node: routeNode("conversation", "current") } };
export const ConversationUnreachable: Story = { args: { node: routeNode("conversation", "unreachable") } };
export const ConversationPast: Story = { args: { node: routeNode("conversation", "past") } };
export const BossAvailable: Story = { args: { node: routeNode("boss", "available") } };
export const BossCurrent: Story = { args: { node: routeNode("boss", "current") } };
export const BossUnreachable: Story = { args: { node: routeNode("boss", "unreachable") } };
export const BossPast: Story = { args: { node: routeNode("boss", "past") } };
