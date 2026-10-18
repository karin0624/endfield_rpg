import type { Meta, StoryObj } from "@storybook/svelte-vite";
import GrowthCandidate from "../../src/web/components/GrowthCandidate.svelte";
import { growthFrame } from "./dungeon-data";

const meta = {
  id: "dungeon-growth-candidate",
  title: "DS未対応/Growth/Candidate",
  component: GrowthCandidate,
  parameters: { design: { host: { width: 656 } } },
  args: { candidate: growthFrame().candidates[0], send: () => false },
} satisfies Meta<typeof GrowthCandidate>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
