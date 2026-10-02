import type { Page } from "@playwright/test";

// Observe native allocations/deletions without keeping the WebGL objects alive.
export async function observeWebGLResources(page: Page) {
  await page.addInitScript(() => {
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const kind of ["Buffer", "Texture", "Program"] as const) {
        const create = `create${kind}` as const;
        const remove = `delete${kind}` as const;
        if (!Object.hasOwn(prototype, create)) continue;
        const originalCreate = prototype[create];
        const originalRemove = prototype[remove];
        const live = new WeakSet<object>();
        Object.defineProperty(prototype, create, {
          value(this: WebGLRenderingContext) {
            const resource = Reflect.apply(originalCreate, this, []) as object | null;
            if (resource !== null) {
              live.add(resource);
              performance.mark(`webgl-create-${kind}`);
            }
            return resource;
          },
        });
        Object.defineProperty(prototype, remove, {
          value(this: WebGLRenderingContext, resource: object | null) {
            if (resource !== null && live.delete(resource)) performance.mark(`webgl-delete-${kind}`);
            Reflect.apply(originalRemove, this, [resource]);
          },
        });
      }
    }
  });
}

export async function webGLResources(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      ["Buffer", "Texture", "Program"].map((kind) => [
        kind,
        performance.getEntriesByName(`webgl-create-${kind}`).length -
          performance.getEntriesByName(`webgl-delete-${kind}`).length,
      ]),
    ),
  );
}
