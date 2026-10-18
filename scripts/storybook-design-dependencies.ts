import { existsSync } from "node:fs";
import { relative, sep } from "node:path";
import type { Plugin } from "vite";

/** Use Vite's resolved module graph, including Svelte/CSS imports, for change selection. */
export function designDependencies(): Plugin {
  let root = "";
  return {
    name: "design-dependencies",
    configResolved(config) {
      root = config.root;
    },
    generateBundle() {
      const localPath = (id: string) => {
        const path = id.split("?")[0];
        const name = relative(root, path).split(sep).join("/");
        return path.startsWith(`${root}${sep}`) && !name.includes("node_modules/") && existsSync(path)
          ? name
          : undefined;
      };
      const closure = (entry: string) => {
        const visited = new Set<string>();
        const files = new Set<string>();
        const visit = (module: string) => {
          if (visited.has(module)) return;
          visited.add(module);
          const file = localPath(module);
          if (file) files.add(file);
          const info = this.getModuleInfo(module);
          for (const imported of [...(info?.importedIds ?? []), ...(info?.dynamicallyImportedIds ?? [])])
            visit(imported);
        };
        visit(entry);
        return files;
      };
      const common = new Set<string>();
      for (const id of this.getModuleIds())
        if ([".storybook/preview.ts", ".storybook/preview-head.html"].includes(localPath(id) ?? ""))
          for (const file of closure(id)) common.add(file);
      const stories: Record<string, string[]> = {};
      for (const id of this.getModuleIds()) {
        const name = localPath(id);
        if (!name?.endsWith(".stories.ts")) continue;
        const files = new Set([...closure(id), ...common]);
        stories[name] = [...files].sort();
      }
      this.emitFile({
        type: "asset",
        fileName: "design-dependencies.json",
        source: JSON.stringify({ version: 1, stories }),
      });
    },
  };
}
