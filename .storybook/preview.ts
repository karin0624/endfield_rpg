import type { Preview } from "@storybook/svelte-vite";
import "../src/web/style.css";
import StoryHost from "./StoryHost.svelte";

const preview: Preview = {
  parameters: { layout: "fullscreen" },
  decorators: [
    (story, context) =>
      context.parameters.design?.host ? { Component: StoryHost, props: context.parameters.design.host } : story(),
  ],
  beforeAll() {
    document.documentElement.lang = "ja";
    document.body.dataset.mode = "game";
  },
  beforeEach() {
    delete document.documentElement.dataset.designStoryReady;
  },
  afterEach(context) {
    document.documentElement.dataset.designStoryReady = context.id;
  },
};

export default preview;
