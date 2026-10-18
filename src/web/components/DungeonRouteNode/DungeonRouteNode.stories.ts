import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { expect, fn } from "storybook/test";
import type { DungeonChromeFrame } from "../../../presentation/dungeonProjection";
import DungeonRouteNode from "./DungeonRouteNode.svelte";

type RouteNode = DungeonChromeFrame["route"]["nodes"][number];
type NodeContent = Omit<RouteNode, "current" | "resolved" | "enabled" | "past" | "icon" | "status" | "label">;

const battleNode: NodeContent = {
  id: "battle-a",
  type: "battle",
  position: {
    x: 34,
    y: 34,
  },
  title: "戦闘",
};

const conversationNode: NodeContent = {
  id: "conversation-b",
  type: "conversation",
  position: {
    x: 34,
    y: 66,
  },
  title: "思わぬ遭遇",
};

const bossNode: NodeContent = {
  id: "boss-c",
  type: "boss",
  position: {
    x: 74,
    y: 50,
  },
  title: "ボス",
};

const meta = {
  id: "dungeon-route-node",
  title: "Dungeon/RouteNode",
  component: DungeonRouteNode,
  parameters: {
    design: {
      host: { width: 210, padding: 160 },
      kind: "component",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".dungeon-route-node", padding: 128, background: "transparent" },
    },
  },
  args: { enter: fn(), focused: fn() },
} satisfies Meta<typeof DungeonRouteNode>;
export default meta;
type Story = StoryObj<typeof meta>;

const availableNodeAcceptsPointerAndKeyboard: NonNullable<Story["play"]> = async ({ canvas, args, userEvent }) => {
  const button = canvas.getByRole("button", { name: args.node.label });
  await userEvent.click(button);
  await expect(button).toHaveFocus();
  await expect(args.focused).toHaveBeenCalledTimes(1);
  await expect(args.focused).toHaveBeenLastCalledWith(args.node.id);
  await expect(args.enter).toHaveBeenCalledTimes(1);
  await expect(args.enter).toHaveBeenLastCalledWith(args.node.id);
  button.blur();
  await userEvent.unhover(button);
  await userEvent.tab();
  await expect(button).toHaveFocus();
  await expect(args.focused).toHaveBeenCalledTimes(2);
  await expect(args.focused).toHaveBeenLastCalledWith(args.node.id);
  await expect(args.enter).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Enter}");
  await expect(args.enter).toHaveBeenCalledTimes(2);
  await expect(args.enter).toHaveBeenLastCalledWith(args.node.id);
  button.blur();
};

const pastNodeIsInert: NonNullable<Story["play"]> = async ({ canvas, args, userEvent }) => {
  const button = canvas.getByRole("button", { name: args.node.label });
  await expect(button).toBeDisabled();
  await userEvent.hover(button);
  await userEvent.click(button);
  button.focus();
  await expect(button).not.toHaveFocus();
  await userEvent.tab();
  await expect(button).not.toHaveFocus();
  await userEvent.keyboard("{Enter} ");
  await expect(args.enter).not.toHaveBeenCalled();
  await expect(args.focused).not.toHaveBeenCalled();
  await userEvent.unhover(button);
};

export const BattleAvailable: Story = {
  play: availableNodeAcceptsPointerAndKeyboard,
  args: {
    node: {
      ...battleNode,
      status: "選択可能",
      label: "戦闘、選択可能",
      current: false,
      resolved: false,
      enabled: true,
      past: false,
      icon: "dungeon-nodes/focus/battle.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/available/default",
          state: "available/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/available/default",
          state: "available/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=default, focus=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/standalone/default+focus",
          state: "available/default+focus",
          figma: {
            path: ["Components/Dungeon", "Dungeon Nodes", "state=available, interaction=default, focus=true"],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=default, focus=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
        {
          id: "Dungeon/RouteNode/battle/available/hover+pointer-focus",
          state: "available/hover+pointer-focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "pressed", selector: ".dungeon-route-node" },
            { type: "release", selector: ".dungeon-route-node" },
          ],
        },
      ],
    },
  },
};
export const BattleCurrent: Story = {
  args: {
    node: {
      ...battleNode,
      status: "現在地",
      label: "戦闘、現在地",
      current: true,
      resolved: false,
      enabled: false,
      past: false,
      icon: "dungeon-nodes/unfocus/battle.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/current/default",
          state: "current/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=current, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/current/default",
          state: "current/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=current, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=current, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=current, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BattleUnreachable: Story = {
  args: {
    node: {
      ...battleNode,
      status: "未到達",
      label: "戦闘、未到達",
      current: false,
      resolved: false,
      enabled: false,
      past: false,
      icon: "dungeon-nodes/unfocus/battle.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=unreachable, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=unreachable, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=unreachable, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=unreachable, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BattlePast: Story = {
  play: pastNodeIsInert,
  args: {
    node: {
      ...battleNode,
      status: "未到達",
      label: "戦闘、未到達",
      current: false,
      resolved: false,
      enabled: false,
      past: true,
      icon: "dungeon-nodes/unfocus/battle.png",
      title: null,
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/past/default",
          state: "past/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/battle",
              "state=past, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/screen-components/past/default",
          state: "past/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=past, interaction=default, focus=false",
            ],
          },
        },
      ],
    },
  },
};
export const ConversationAvailable: Story = {
  play: availableNodeAcceptsPointerAndKeyboard,
  args: {
    node: {
      ...conversationNode,
      status: "選択可能",
      label: "思わぬ遭遇、選択可能",
      current: false,
      resolved: false,
      enabled: true,
      past: false,
      icon: "dungeon-nodes/focus/encounter.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/available/default",
          state: "available/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/available/default",
          state: "available/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=default, focus=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=default, focus=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
        {
          id: "Dungeon/RouteNode/conversation/available/hover+pointer-focus",
          state: "available/hover+pointer-focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "pressed", selector: ".dungeon-route-node" },
            { type: "release", selector: ".dungeon-route-node" },
          ],
        },
      ],
    },
  },
};
export const ConversationCurrent: Story = {
  args: {
    node: {
      ...conversationNode,
      status: "現在地",
      label: "思わぬ遭遇、現在地",
      current: true,
      resolved: false,
      enabled: false,
      past: false,
      icon: "dungeon-nodes/unfocus/encounter.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/current/default",
          state: "current/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=current, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/current/default",
          state: "current/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=current, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=current, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=current, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const ConversationUnreachable: Story = {
  args: {
    node: {
      ...conversationNode,
      status: "未到達",
      label: "思わぬ遭遇、未到達",
      current: false,
      resolved: false,
      enabled: false,
      past: false,
      icon: "dungeon-nodes/unfocus/encounter.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=unreachable, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=unreachable, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=unreachable, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=unreachable, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const ConversationPast: Story = {
  play: pastNodeIsInert,
  args: {
    node: {
      ...conversationNode,
      status: "未到達",
      label: "思わぬ遭遇、未到達",
      current: false,
      resolved: false,
      enabled: false,
      past: true,
      icon: "dungeon-nodes/unfocus/encounter.png",
      title: null,
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/past/default",
          state: "past/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/conversation",
              "state=past, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/screen-components/past/default",
          state: "past/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=past, interaction=default, focus=false",
            ],
          },
        },
      ],
    },
  },
};
export const BossAvailable: Story = {
  play: availableNodeAcceptsPointerAndKeyboard,
  args: {
    node: {
      ...bossNode,
      status: "選択可能",
      label: "ボス、選択可能",
      current: false,
      resolved: false,
      enabled: true,
      past: false,
      icon: "dungeon-nodes/focus/boss.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/available/default",
          state: "available/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/available/default",
          state: "available/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=default, focus=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=default, focus=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
        {
          id: "Dungeon/RouteNode/boss/available/hover+pointer-focus",
          state: "available/hover+pointer-focus",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=hover, focus=true",
            ],
          },
          interaction: [
            { type: "pressed", selector: ".dungeon-route-node" },
            { type: "release", selector: ".dungeon-route-node" },
          ],
        },
      ],
    },
  },
};
export const BossCurrent: Story = {
  args: {
    node: {
      ...bossNode,
      status: "現在地",
      label: "ボス、現在地",
      current: true,
      resolved: false,
      enabled: false,
      past: false,
      icon: "dungeon-nodes/unfocus/boss.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/current/default",
          state: "current/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=current, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/current/default",
          state: "current/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=current, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=current, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=current, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BossUnreachable: Story = {
  args: {
    node: {
      ...bossNode,
      status: "未到達",
      label: "ボス、未到達",
      current: false,
      resolved: false,
      enabled: false,
      past: false,
      icon: "dungeon-nodes/unfocus/boss.png",
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=unreachable, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=unreachable, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=unreachable, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=unreachable, interaction=hover, focus=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BossPast: Story = {
  play: pastNodeIsInert,
  args: {
    node: {
      ...bossNode,
      status: "未到達",
      label: "ボス、未到達",
      current: false,
      resolved: false,
      enabled: false,
      past: true,
      icon: "dungeon-nodes/unfocus/boss.png",
      title: null,
    },
  },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/past/default",
          state: "past/default",
          figma: {
            path: [
              "Components/Dungeon",
              "Dungeon Nodes",
              "Dungeon/RouteNode/boss",
              "state=past, interaction=default, focus=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/screen-components/past/default",
          state: "past/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=past, interaction=default, focus=false",
            ],
          },
        },
      ],
    },
  },
};
