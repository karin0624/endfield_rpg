import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { routeNode } from "../../../../.storybook/fixtures/dungeon-data";
import DungeonRouteNode from "./DungeonRouteNode.svelte";

const meta = {
  id: "dungeon-route-node",
  title: "DS未対応/Dungeon/RouteNode",
  component: DungeonRouteNode,
  parameters: {
    design: {
      host: { width: 210, padding: 160 },
      kind: "component",
      viewport: { width: 1920, height: 1208 },
      capture: { selector: ".dungeon-route-node", padding: 128, background: "transparent" },
    },
  },
  args: { node: routeNode("battle", "available"), enter: () => {}, focused: () => {} },
} satisfies Meta<typeof DungeonRouteNode>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BattleAvailable: Story = {
  args: { node: routeNode("battle", "available") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/available/default",
          state: "available/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=default, focusVisible=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/battle/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=available, interaction=hover, focusVisible=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
      ],
    },
  },
};
export const BattleCurrent: Story = {
  args: { node: routeNode("battle", "current") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/current/default",
          state: "current/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=current, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=current, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BattleUnreachable: Story = {
  args: { node: routeNode("battle", "unreachable") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=unreachable, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=unreachable, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BattlePast: Story = {
  args: { node: routeNode("battle", "past") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/battle",
      targets: [
        {
          id: "Dungeon/RouteNode/battle/past/default",
          state: "past/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=past, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/battle/past/hover",
          state: "past/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/battle",
              "state=past, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const ConversationAvailable: Story = {
  args: { node: routeNode("conversation", "available") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/available/default",
          state: "available/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=default, focusVisible=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/conversation/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=available, interaction=hover, focusVisible=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
      ],
    },
  },
};
export const ConversationCurrent: Story = {
  args: { node: routeNode("conversation", "current") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/current/default",
          state: "current/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=current, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=current, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const ConversationUnreachable: Story = {
  args: { node: routeNode("conversation", "unreachable") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=unreachable, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=unreachable, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const ConversationPast: Story = {
  args: { node: routeNode("conversation", "past") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/conversation",
      targets: [
        {
          id: "Dungeon/RouteNode/conversation/past/default",
          state: "past/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=past, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/conversation/past/hover",
          state: "past/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/conversation",
              "state=past, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BossAvailable: Story = {
  args: { node: routeNode("boss", "available") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/available/default",
          state: "available/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/available/default+focus",
          state: "available/default+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=default, focusVisible=true",
            ],
          },
          interaction: [{ type: "focus", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/available/hover",
          state: "available/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
        {
          id: "Dungeon/RouteNode/boss/available/hover+focus",
          state: "available/hover+focus",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=available, interaction=hover, focusVisible=true",
            ],
          },
          interaction: [
            { type: "focus", selector: ".dungeon-route-node" },
            { type: "hover", selector: ".dungeon-route-node" },
          ],
        },
      ],
    },
  },
};
export const BossCurrent: Story = {
  args: { node: routeNode("boss", "current") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/current/default",
          state: "current/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=current, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/current/hover",
          state: "current/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=current, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BossUnreachable: Story = {
  args: { node: routeNode("boss", "unreachable") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/unreachable/default",
          state: "unreachable/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=unreachable, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/unreachable/hover",
          state: "unreachable/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=unreachable, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
export const BossPast: Story = {
  args: { node: routeNode("boss", "past") },
  parameters: {
    design: {
      component: "Dungeon/RouteNode/boss",
      targets: [
        {
          id: "Dungeon/RouteNode/boss/past/default",
          state: "past/default",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=past, interaction=default, focusVisible=false",
            ],
          },
        },
        {
          id: "Dungeon/RouteNode/boss/past/hover",
          state: "past/hover",
          figma: {
            path: [
              "Screens / DS未対応",
              "Dungeon route / Local Components — DS未対応",
              "Dungeon/RouteNode/boss",
              "state=past, interaction=hover, focusVisible=false",
            ],
          },
          interaction: [{ type: "hover", selector: ".dungeon-route-node" }],
        },
      ],
    },
  },
};
