import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { designDependencies } from "../scripts/storybook-design-dependencies.ts";

export default defineConfig({ plugins: [svelte(), designDependencies()] });
