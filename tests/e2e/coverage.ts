import { type Browser, type BrowserContext, test as base, type Page, type Request } from "@playwright/test";
import { browserCoverage } from "../../scripts/browser-coverage.mjs";

export { expect } from "@playwright/test";

const enabled = process.env.COVERAGE_BROWSER === "1";
const collectors = new WeakMap<Page, () => Promise<void>>();
const createdContexts = new WeakMap<Browser, BrowserContext[]>();

/** Collect immediately before a reload or a second document navigation. V8 can discard old document hits. */
export async function collectCoverage(page: Page) {
  if (!enabled || page.url() === "about:blank") return;
  const collect = collectors.get(page);
  if (!collect) throw new Error("Coverage checkpoint requires the coverage page fixture");
  await collect();
}

export const test = base.extend<{ _coverageBoundary: undefined }>({
  browser: async ({ browser }, use) => {
    if (!enabled) return use(browser);
    const contexts: BrowserContext[] = [];
    // A scoped fixture wrapper records even contexts closed before teardown; the real browser is never patched.
    const monitored = new Proxy(browser, {
      get(target, property) {
        if (property === "newContext")
          return async (...options: Parameters<Browser["newContext"]>) => {
            const context = await target.newContext(...options);
            contexts.push(context);
            return context;
          };
        if (property === "newPage")
          return async (...options: Parameters<Browser["newPage"]>) => {
            const page = await target.newPage(...options);
            contexts.push(page.context());
            return page;
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    createdContexts.set(monitored, contexts);
    await use(monitored);
  },
  _coverageBoundary: [
    async ({ page, browser }, use) => {
      if (!enabled) return use(undefined);
      // Auto activates page collection even when a case asks only for browser or request.
      const contexts = createdContexts.get(browser);
      if (!contexts) throw new Error("Browser coverage requires the monitored browser fixture");
      const existingExtra = [...contexts, ...browser.contexts()].some((context) => context !== page.context());
      contexts.length = 0;
      await use(undefined);
      const extra = contexts.some((context) => context !== page.context());
      contexts.length = 0;
      if (existingExtra || extra)
        throw new Error("Additional browser contexts need the shared context/page fixtures for coverage");
    },
    { auto: true },
  ],
  page: async ({ page, context, browserName }, use, testInfo) => {
    if (!enabled) return use(page);
    if (browserName !== "chromium") throw new Error("Native browser coverage requires Chromium");
    const unexpected: Page[] = [];
    const onPage = (opened: Page) => unexpected.push(opened);
    context.on("page", onPage);
    let needsCheckpoint = false;
    let documentNavigations = 0;
    let mappedEntries = 0;
    const missedNavigations: string[] = [];
    const onRequest = (request: Request) => {
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame() || request.redirectedFrom()) return;
      documentNavigations++;
      if (needsCheckpoint) missedNavigations.push(request.url());
      needsCheckpoint = true;
    };
    page.on("request", onRequest);
    const report = browserCoverage(testInfo.project.name);
    async function collect(restart = true) {
      if (page.isClosed()) throw new Error("Page closed before browser coverage collection");
      const entries = await page.coverage.stopJSCoverage();
      const mapped = [];
      for (const entry of entries) {
        if (!entry.url.startsWith("http")) continue;
        const path = new URL(entry.url).pathname;
        if (!(path.includes("/src/") && path.endsWith(".ts")) && !(path.includes("/assets/") && path.endsWith(".js")))
          continue;
        // Vite's generated preload helper has no original application source.
        if (/\/preload-helper-[^/]+\.js$/.test(path)) continue;
        const inline = entry.source?.match(/sourceMappingURL=data:application\/json[^,]*;base64,([^\s]+)/);
        // Vite also emits import/re-export-only facades; their implementation is in the mapped target chunk.
        const facade = /^import \{[\w$ ,]+\} from "\.\/[^"\n]+\.js";\s*export \{[\w$ ,]+\};\s*$/.test(
          entry.source ?? "",
        );
        if (!inline && facade) continue;
        if (!inline) throw new Error(`Missing inline source map: ${entry.url}`);
        const sourceMap = JSON.parse(Buffer.from(inline[1], "base64").toString("utf8"));
        if (!Array.isArray(sourceMap.sources)) throw new Error(`Invalid source map: ${entry.url}`);
        if (path.includes("/src/") || sourceMap.sources.some((source: string) => /(?:^|\/)src\//.test(source))) {
          mapped.push({ ...entry, sourceMap });
        }
      }
      if (mapped.length) {
        await report.add(mapped);
        mappedEntries += mapped.length;
      }
      needsCheckpoint = false;
      if (restart) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    }
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    collectors.set(page, () => collect());
    await use(page);
    collectors.delete(page);
    context.off("page", onPage);
    page.off("request", onRequest);
    await collect(false);
    testInfo.annotations.push({
      type: "browser-coverage",
      description: `documents=${documentNavigations}, mappedEntries=${mappedEntries}`,
    });
    if (documentNavigations && !mappedEntries) throw new Error("No mapped application execution for this browser case");
    if (missedNavigations.length)
      throw new Error(`Coverage checkpoint missing before navigation: ${missedNavigations.join(", ")}`);
    if (unexpected.length)
      throw new Error("Additional browser pages need an explicit coverage fixture before navigation");
  },
});
